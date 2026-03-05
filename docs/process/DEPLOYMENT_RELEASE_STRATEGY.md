# Ocean Brain Deployment and Release Strategy

Updated: 2026-03-06

## 1. Current Deployment Channels (As-Is)
1. npm distribution
- Published package: `ocean-brain` (`packages/cli`)
- Run via: `npx ocean-brain` or `npx ocean-brain@<version>`

2. Docker distribution
- Image: `baealex/ocean-brain`
- Tags: `latest`, `<version>`
- Multi-arch targets: `linux/amd64`, `linux/arm64`

3. Source-based run
- `pnpm install && pnpm build && pnpm start`

## 2. Release Trigger
- GitHub Actions `RELEASE` runs only on `v*` tag pushes.
- Example: `v0.2.1`

## 3. Release Pipeline Details
1. `publish-npm`
- Installs Node 22 and pnpm
- Runs `bash scripts/prepublish.sh`
- Publishes with `pnpm --filter ocean-brain publish --no-git-checks --access public`
- Requires `NPM_TOKEN`
- Creates GitHub Release notes automatically

2. `publish-docker`
- Runs after successful `publish-npm`
- Extracts version from tag (`vX.Y.Z` -> `X.Y.Z`)
- Builds and pushes per architecture via DockerHub
- Requires `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`

3. `publish-docker-manifest`
- Combines architecture digests into one manifest
- Pushes final tags: `<version>`, `latest`

## 4. Prepublish Build Strategy
- `scripts/prepublish.sh` standardizes release artifacts.
1. Builds `@ocean-brain/client`
2. Builds `@ocean-brain/server`
3. Builds `ocean-brain` (CLI)
4. Copies artifacts into `packages/cli/server/**`
- Result: only CLI is published to npm, with bundled server/client artifacts.

## 5. Manual Release Runbook
1. Verify release package
- `bash scripts/test-cli-publish.sh`

2. Bump version
- `bash scripts/bump-version.sh <version>`
- This updates only `packages/cli/package.json`.

3. Commit, tag, push
- `git add -A`
- `git commit -m "📦 Bump version to <version>"`
- `git tag v<version>`
- `git push origin main --tags`

4. After tag push
- `RELEASE` automatically publishes npm + Docker artifacts.

## 6. Runtime Deployment Strategy
1. Stable production
- Pin Docker image to explicit version tag instead of `latest`
- Example: `baealex/ocean-brain:0.2.0`

2. Fast trial/development
- Use `npx ocean-brain` or Docker `latest`

3. Rollback
- Docker: redeploy a previous image tag
- npm/npx: run `npx ocean-brain@<previous-version>`

## 7. Required Secrets
- `NPM_TOKEN`
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
