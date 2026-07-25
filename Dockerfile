# sqlite-vec's published Linux binaries target glibc. Build the same pinned
# extension for Alpine's musl libc in a disposable stage instead of enlarging
# the runtime image with a second libc or a compiler toolchain.
FROM alpine:3.24 AS sqlite-vec-build

# Keep this source revision aligned with the sqlite-vec version in the npm package.
ARG SQLITE_VEC_COMMIT=e9f598abfa0c06b328d8fe5da9c3760cce74be10
ARG SQLITE_VEC_SOURCE_SHA256=ee2eb0be751c02286d5a6c6c113dd9e754f0ac29973b01aba35a2d736e35ed3b
ARG SQLITE_AMALGAMATION_SHA256=ea170e73e447703e8359308ca2e4366a3ae0c4304a8665896f068c736781c651

RUN apk add --no-cache build-base curl gettext-envsubst unzip \
    && mkdir -p /tmp/sqlite-vec \
    && curl -fsSL \
        "https://github.com/asg017/sqlite-vec/archive/${SQLITE_VEC_COMMIT}.tar.gz" \
        -o /tmp/sqlite-vec.tar.gz \
    && echo "${SQLITE_VEC_SOURCE_SHA256}  /tmp/sqlite-vec.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/sqlite-vec.tar.gz --strip-components=1 -C /tmp/sqlite-vec \
    && curl -fsSL \
        https://www.sqlite.org/2024/sqlite-amalgamation-3450300.zip \
        -o /tmp/sqlite-amalgamation.zip \
    && echo "${SQLITE_AMALGAMATION_SHA256}  /tmp/sqlite-amalgamation.zip" | sha256sum -c - \
    && mkdir -p /tmp/sqlite-vec/vendor \
    && unzip -q /tmp/sqlite-amalgamation.zip -d /tmp \
    && mv /tmp/sqlite-amalgamation-3450300/* /tmp/sqlite-vec/vendor/ \
    && cd /tmp/sqlite-vec \
    && sqlite_vec_version="$(cat VERSION)" \
    && sqlite_vec_major="$(echo "${sqlite_vec_version}" | cut -d. -f1)" \
    && sqlite_vec_minor="$(echo "${sqlite_vec_version}" | cut -d. -f2)" \
    && sqlite_vec_patch="$(echo "${sqlite_vec_version}" | cut -d. -f3 | cut -d- -f1)" \
    && mkdir -p dist \
    && VERSION="${sqlite_vec_version}" \
        DATE="$(date -u +%FT%TZ)" \
        SOURCE="${SQLITE_VEC_COMMIT}" \
        VERSION_MAJOR="${sqlite_vec_major}" \
        VERSION_MINOR="${sqlite_vec_minor}" \
        VERSION_PATCH="${sqlite_vec_patch}" \
        envsubst < sqlite-vec.h.tmpl > sqlite-vec.h \
    && cc -fPIC -shared -Wall -Wextra -Ivendor/ -O3 -include sys/types.h -lm sqlite-vec.c -o dist/vec0.so \
    && strip --strip-unneeded /tmp/sqlite-vec/dist/vec0.so \
    && test -s /tmp/sqlite-vec/dist/vec0.so

FROM node:22-alpine AS install

ARG VERSION=latest
ARG TARGETARCH
RUN npm i -g --omit=dev --no-audit --no-fund ocean-brain@${VERSION} \
    && APP_ROOT="$(npm root -g)/ocean-brain" \
    && find "$APP_ROOT" -type f \( \
        -name '*.map' -o \
        -name '*.d.ts' -o \
        -name '*.d.mts' -o \
        -name '*.d.cts' \
    \) -delete

COPY --from=sqlite-vec-build /tmp/sqlite-vec/dist/vec0.so /tmp/vec0.so

RUN case "${TARGETARCH}" in \
        amd64) SQLITE_VEC_PACKAGE=sqlite-vec-linux-x64 ;; \
        arm64) SQLITE_VEC_PACKAGE=sqlite-vec-linux-arm64 ;; \
        *) echo "Unsupported Docker architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && SQLITE_VEC_PATH="/usr/local/lib/node_modules/ocean-brain/node_modules/${SQLITE_VEC_PACKAGE}/vec0.so" \
    && test -f "${SQLITE_VEC_PATH}" \
    && cp /tmp/vec0.so "${SQLITE_VEC_PATH}" \
    && rm /tmp/vec0.so \
    && cd /usr/local/lib/node_modules/ocean-brain \
    && node --input-type=module -e 'import sqlite3 from "sqlite3"; import { getLoadablePath } from "sqlite-vec"; const database = new sqlite3.Database(":memory:"); database.loadExtension(getLoadablePath(), (error) => { if (error) { console.error(error); process.exitCode = 1; } database.close(); });'

FROM alpine:3.24

RUN apk add --no-cache libgcc libstdc++ openssl

COPY --from=install /usr/local/bin/node /usr/local/bin/node
COPY --from=install /usr/local/lib/node_modules/ocean-brain /usr/local/lib/node_modules/ocean-brain

RUN ln -s ../lib/node_modules/ocean-brain/dist/index.js /usr/local/bin/ocean-brain \
    && mkdir -p /data /assets/images

ENV OCEAN_BRAIN_DATA_DIR=/data
ENV OCEAN_BRAIN_IMAGE_DIR=/assets/images
ENV DATABASE_URL="file:/data/db.sqlite3"

EXPOSE 6683
CMD ["ocean-brain", "serve"]
