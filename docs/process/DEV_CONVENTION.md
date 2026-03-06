# Ocean Brain Dev Convention

Updated: 2026-03-06

## 1. Base Environment
- Node.js: `22`
- Package manager: `pnpm@10.25.0`
- Workspace: `packages/*` (pnpm workspace)

## 2. Local Development Commands
- Full dev mode: `pnpm dev`
- Client only: `pnpm dev:client`
- Server only: `pnpm dev:server`
- Full build: `pnpm build`
- Server start: `pnpm start`

## 3. Standard Quality Checks
- `pnpm lint`
- `pnpm type-check`
- `pnpm build`

## 4. Minimum Rules Before PR
1. Complete local validation for changed scope.
2. Push only when CI is expected to pass.
3. Document script/env/doc changes in PR body.
4. Validate PR metadata against template before sharing PR link:
   - Title: `<emoji_shortcode> <subject>`
   - Body sections: `:dart: Goal`, `:hammer_and_wrench: Core Changes`, `:brain: Key Decisions`, `:test_tube: Verification Guide`, `:white_check_mark: Checklist`

## 5. Server and Release Linked Rules
- Server start script includes `prisma migrate deploy`.
- Use `bash scripts/prepublish.sh` for release artifact preparation.
- `bash scripts/test-cli-publish.sh` is recommended before release.

## 6. Related Documents
- Git rules: `docs/process/GIT_CONVENTION.md`
- Deployment/release: `docs/process/DEPLOYMENT_RELEASE_STRATEGY.md`
