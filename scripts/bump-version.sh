#!/bin/bash
set -e

# 버전 업데이트 스크립트
# 사용법: ./scripts/bump-version.sh <version>
# 예시: ./scripts/bump-version.sh 1.2.0

if [ -z "$1" ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 1.2.0"
    exit 1
fi

VERSION="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# ocean-brain (CLI) 패키지 버전 업데이트 — 유일한 publishable 패키지
node -e "
const pkg = require('./packages/cli/package.json');
pkg.version = '$VERSION';
require('fs').writeFileSync('./packages/cli/package.json', JSON.stringify(pkg, null, 4) + '\n');
"

echo "Updated packages/cli/package.json -> $VERSION"
echo ""
echo "Next steps:"
echo "  git add -A"
echo "  git commit -m \"chore: release v$VERSION\""
echo "  git tag v$VERSION"
echo "  git push origin main --tags"
