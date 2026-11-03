# syntax=docker/dockerfile:1
FROM node:24.22.1-trixie-slim@sha256:43b9ba1142b8dcf33fa8f922ca1be85714adc444e0586c7cf7726daaeabc1bea AS install

ARG VERSION=latest
ARG PACKAGE_SPEC=ocean-brain@${VERSION}
RUN --mount=type=bind,target=/build \
    npm i -g --omit=dev --no-audit --no-fund "${PACKAGE_SPEC}" \
    && mkdir -p /runtime/data /runtime/assets/images

# Remove large files the server never loads. A missing target is skipped so a
# dependency layout change only costs image size, never a failed release build.
RUN <<'EOF'
set -eu
APP_ROOT="$(npm root -g)/ocean-brain"
NM="$APP_ROOT/node_modules"

find "$APP_ROOT" -type f \( \
    -name '*.map' -o \
    -name '*.d.ts' -o \
    -name '*.d.mts' -o \
    -name '*.d.cts' \
\) -delete

# Prisma Client runs the native library engine for SQLite. The base64 WASM
# engines are only for driver adapters and edge runtimes.
if [ -d "$NM/@prisma/client/runtime" ]; then
    find "$NM/@prisma/client/runtime" -type f -name '*.wasm-base64.*' -delete
fi

# The Prisma CLI only runs `migrate deploy` against SQLite.
if [ -d "$NM/prisma/build" ]; then
    find "$NM/prisma/build" -maxdepth 1 -type f \
        \( -name 'query_engine_bg.*.wasm' -o -name 'query_compiler_bg.*.wasm' \) \
        ! -name '*.sqlite.wasm' -delete
    rm -rf "$NM/prisma/build/public"
fi

# npm installs the same query engine for Prisma Client, the CLI, and
# @prisma/engines. Hardlink identical copies so every expected path remains.
for engine in "$NM"/.prisma/client/libquery_engine-*.so.node; do
    if [ ! -f "$engine" ]; then
        continue
    fi
    name="$(basename "$engine")"
    for copy in "$NM/prisma/$name" "$NM/@prisma/engines/$name"; do
        if [ -f "$copy" ] && cmp -s "$engine" "$copy"; then
            ln -f "$engine" "$copy"
        fi
    done
done

# BlockNote imports only the package entry emoji set, and only in the
# browser emoji picker. Keep the entry set and drop older Unicode versions.
EMOJI_DATA="$NM/@emoji-mart/data"
if [ -f "$EMOJI_DATA/package.json" ]; then
    # Prints the entry set directory name, or nothing when main is not sets/<name>/<file>.
    EMOJI_SET="$(EMOJI_DATA="$EMOJI_DATA" node -p '
        const path = require("node:path");
        const root = process.env.EMOJI_DATA;
        const main = require(path.join(root, "package.json")).main ?? "";
        const parts = path.relative(path.join(root, "sets"), path.resolve(root, main)).split(path.sep);
        parts.length === 2 && !parts[0].startsWith(".") ? parts[0] : ""
    ')"
    if [ -n "$EMOJI_SET" ] && [ -d "$EMOJI_DATA/sets/$EMOJI_SET" ]; then
        find "$EMOJI_DATA/sets" -mindepth 1 -maxdepth 1 -type d \
            ! -name "$EMOJI_SET" -exec rm -rf {} +
    fi
fi

# TypeScript sources shipped for source maps. Package exports do not load them.
rm -rf "$NM/effect/src" "$NM/zod/src"
EOF

# Fail before publishing if pruning broke startup migrations or the query engine.
# No network: Prisma must not try to download a removed engine at runtime.
RUN --network=none <<'EOF'
set -eu
APP_ROOT="$(npm root -g)/ocean-brain"
VERIFY_DIR="$(mktemp -d)"
export DATABASE_URL="file:$VERIFY_DIR/db.sqlite3"
# The runtime image has no Prisma engine cache. Hide the install-time cache so
# a removed engine fails here instead of being restored from it.
export HOME="$VERIFY_DIR/home" XDG_CACHE_HOME="$VERIFY_DIR/cache"
mkdir -p "$HOME" "$XDG_CACHE_HOME"

node "$APP_ROOT/node_modules/prisma/build/index.js" migrate deploy \
    --schema="$APP_ROOT/server/prisma/schema.prisma"

APP_ROOT="$APP_ROOT" node -e '
const { createRequire } = require("node:module");
const appRequire = createRequire(`${process.env.APP_ROOT}/server/dist/`);
const { PrismaClient } = appRequire("@prisma/client");

(async () => {
    const prisma = new PrismaClient();
    try {
        await prisma.cache.findMany({ take: 1 });
        const [{ count }] = await prisma.$queryRawUnsafe(
            "SELECT COUNT(*) AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL"
        );
        if (Number(count) === 0) {
            throw new Error("No applied migrations found");
        }
        console.log(`Prisma runtime verification passed: ${count} migrations`);
    } finally {
        await prisma.$disconnect();
    }
})().catch(error => {
    console.error(error);
    process.exit(1);
});
'

rm -rf "$VERIFY_DIR"
EOF

# Keep the current root-user behavior so existing host bind mounts remain writable.
# The distroless runtime still removes the shell and package manager.
FROM gcr.io/distroless/nodejs24-debian13:latest@sha256:c23cc7262662efd642cd9c9d61783d10f600321f7bafdd37c8a82365ffaa2aa6

COPY --from=install /usr/local/lib/node_modules/ocean-brain /usr/local/lib/node_modules/ocean-brain
COPY --from=install /runtime/data /data
COPY --from=install /runtime/assets /assets

ENV OCEAN_BRAIN_DATA_DIR=/data
ENV OCEAN_BRAIN_IMAGE_DIR=/assets/images
ENV DATABASE_URL="file:/data/db.sqlite3"

EXPOSE 6683
CMD ["/usr/local/lib/node_modules/ocean-brain/dist/index.js", "serve"]
