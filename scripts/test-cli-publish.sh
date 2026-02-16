#!/bin/bash
set -e

# CLI 배포 시뮬레이션 테스트
# prepublish 후 npm pack으로 실제 publish될 내용을 검증하고,
# 서버가 정상적으로 시작되는지 확인합니다.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_DIR=$(mktemp -d)
DATA_DIR="$TEST_DIR/data"

cleanup() {
    echo ""
    echo "=== Cleanup ==="
    if [ -n "$SERVER_PID" ]; then
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
    rm -rf "$TEST_DIR"
    # prepublish로 생성된 server/ 정리
    rm -rf "$ROOT_DIR/packages/cli/server"
    echo "Temp directory removed: $TEST_DIR"
}
trap cleanup EXIT

echo "=== CLI Publish Simulation Test ==="
echo "Test dir: $TEST_DIR"
echo ""

# 1. prepublish (client/server 빌드 → CLI에 복사)
echo "=== Step 1: Run prepublish ==="
cd "$ROOT_DIR"
bash scripts/prepublish.sh
echo ""

# 2. npm pack으로 실제 publish될 tarball 생성
echo "=== Step 2: npm pack (simulate publish) ==="
cd "$ROOT_DIR/packages/cli"
TARBALL=$(npm pack --pack-destination "$TEST_DIR" 2>/dev/null)
echo "Created: $TARBALL"

# tarball 풀기
cd "$TEST_DIR"
tar xzf "$TARBALL"
PACK_DIR="$TEST_DIR/package"
echo ""

# 3. 구조 확인
echo "=== Step 3: Verify package structure ==="
echo -n "  dist/index.js: "
[ -f "$PACK_DIR/dist/index.js" ] && echo "OK" || { echo "FAIL"; exit 1; }

echo -n "  server/dist/main.js: "
[ -f "$PACK_DIR/server/dist/main.js" ] && echo "OK" || { echo "FAIL"; exit 1; }

echo -n "  server/prisma/schema.prisma: "
[ -f "$PACK_DIR/server/prisma/schema.prisma" ] && echo "OK" || { echo "FAIL"; exit 1; }

echo -n "  server/prisma/migrations/: "
[ -d "$PACK_DIR/server/prisma/migrations" ] && echo "OK" || { echo "FAIL"; exit 1; }

echo -n "  server/client/dist/index.html: "
[ -f "$PACK_DIR/server/client/dist/index.html" ] && echo "OK" || { echo "FAIL"; exit 1; }
echo ""

# 4. 의존성 설치 (실제 npm install 시뮬레이션)
echo "=== Step 4: Install dependencies ==="
cd "$PACK_DIR"
npm install --ignore-scripts 2>&1 | tail -1
npx prisma generate --schema="$PACK_DIR/server/prisma/schema.prisma"
echo ""

# 5. 서버 시작
echo "=== Step 5: Start server via CLI ==="
mkdir -p "$DATA_DIR/assets/images"

DATABASE_URL="file:$DATA_DIR/db.sqlite3" \
OCEAN_BRAIN_DATA_DIR="$DATA_DIR" \
    npx prisma migrate deploy --schema="$PACK_DIR/server/prisma/schema.prisma"

DATABASE_URL="file:$DATA_DIR/db.sqlite3" \
OCEAN_BRAIN_DATA_DIR="$DATA_DIR" \
PORT=3099 \
    node "$PACK_DIR/dist/index.js" serve &
SERVER_PID=$!

echo "Waiting for server..."
for i in $(seq 1 10); do
    curl -s -o /dev/null http://localhost:3099/ 2>/dev/null && break
    sleep 1
done

# 6. 응답 확인
echo "=== Step 6: Verify server response ==="
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3099/)
echo -n "  HTTP GET /: "
[ "$HTTP_CODE" = "200" ] && echo "OK ($HTTP_CODE)" || { echo "FAIL ($HTTP_CODE)"; exit 1; }

GRAPHQL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3099/graphql \
    -H "Content-Type: application/json" \
    -d '{"query":"{ allImages(pagination: {limit: 1, offset: 0}) { totalCount } }"}')
echo -n "  POST /graphql: "
[ "$GRAPHQL_CODE" = "200" ] && echo "OK ($GRAPHQL_CODE)" || { echo "FAIL ($GRAPHQL_CODE)"; exit 1; }

echo ""
echo "=== ALL TESTS PASSED ==="
