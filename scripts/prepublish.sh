#!/bin/bash
set -e

# 릴리스 전 빌드 스크립트
# client/server를 빌드하고 CLI 패키지에 모든 결과물을 복사합니다.
# ocean-brain (CLI)만 npm에 publish됩니다.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CLI_DIR="$ROOT_DIR/packages/cli"

cd "$ROOT_DIR"

echo "=== Build client ==="
pnpm --filter @ocean-brain/client build

echo "=== Build server ==="
pnpm --filter @ocean-brain/server build

echo "=== Build CLI ==="
pnpm --filter ocean-brain build

echo "=== Copy artifacts to CLI package ==="
rm -rf "$CLI_DIR/server"

# server dist
mkdir -p "$CLI_DIR/server/dist"
cp -r packages/server/dist/* "$CLI_DIR/server/dist/"

# prisma schema + migrations
mkdir -p "$CLI_DIR/server/prisma"
cp packages/server/prisma/schema.prisma "$CLI_DIR/server/prisma/"
cp -r packages/server/prisma/migrations "$CLI_DIR/server/prisma/"

# client dist
mkdir -p "$CLI_DIR/server/client/dist"
cp -r packages/client/dist/* "$CLI_DIR/server/client/dist/"

echo "=== Done ==="
echo "CLI package is ready to publish."
echo "  cd packages/cli && pnpm publish --access public"
