# Ocean Brain Deployment and Release Strategy

Updated: 2026-04-06

## 1. Current Deployment Channels
1. npm distribution
- Published package: `ocean-brain` (`packages/cli`)
- Run via: `npx ocean-brain` or `npx ocean-brain@<version>`

2. Docker distribution
- Image: `baealex/ocean-brain`
- Tags: `latest`, `<version>`
- Multi-arch targets: `linux/amd64`, `linux/arm64`

3. Source-based run
- `pnpm install && pnpm build && pnpm start`

## 2. Versioned Install and Run Rules
1. Production
- npx: `npx ocean-brain@<exact-version>`
- Docker: `baealex/ocean-brain:<exact-version>`
- Do not use floating `latest` in production.

2. Fast trial/development
- npx: `npx ocean-brain` or `npx ocean-brain@latest`
- Docker: `baealex/ocean-brain:latest`

3. Rollback target
- npx: `npx ocean-brain@<previous-version>`
- Docker: `baealex/ocean-brain:<previous-version>`

## 3. Release Trigger
- GitHub Actions `RELEASE` runs only on an explicit `v*` tag push.
- Example: `v0.3.1`
- Official release trigger:

```bash
git tag v0.3.1
git push origin v0.3.1
```

- Do not rely on automatic tag creation as the release trigger.
- Every tagged release must include a written GitHub Release note at:
  `https://github.com/baealex/ocean-brain/releases/tag/vX.Y.Z`

## 4. Release Pipeline Details
1. `publish-npm`
- Installs Node 22 and pnpm
- Runs `node scripts/release/prepublish.mjs`
- Publishes with `npm publish --provenance --access public` from `packages/cli`
- Uses npm trusted publishing (OIDC) via GitHub Actions
- Creates a GitHub Release with auto-generated notes (`generate_release_notes: true`)

2. `publish-docker`
- Runs after successful `publish-npm`
- Extracts version from tag (`vX.Y.Z` -> `X.Y.Z`)
- Builds and pushes per architecture via DockerHub
- Requires `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`

3. `publish-docker-manifest`
- Combines architecture digests into one manifest
- Pushes final tags: `<version>`, `latest`

## 5. Prepublish Build Strategy
- `scripts/release/prepublish.mjs` standardizes release artifacts.
1. Builds `@ocean-brain/client`
2. Builds `@ocean-brain/server`
3. Builds `ocean-brain` (CLI)
4. Copies artifacts into `packages/cli/server/**`
- Result: only CLI is published to npm, with bundled server/client artifacts.

## 6. Manual Release Runbook
1. Verify release package
- Required: latest `CLI_SMOKE` workflow is green for the release target PR or commit.

2. Collect unreleased changes before version bump
- Commit list:
  `git log v<previous-version>..HEAD --pretty=format:"%h %s"`
- PR merge list:
  `git log v<previous-version>..HEAD --merges --pretty=format:"%s"`

3. Bump version
- `node scripts/release/bump-version.mjs <version>`
- This updates only `packages/cli/package.json`.

4. Create dedicated release branch
- `git checkout -b chore/release-v<version>`

5. Commit version bump
- `git add packages/cli/package.json`
- `git commit -m "🔖 Bump version to <version>"`
- Version bump must be a separate PR. Direct release bumps on `main` are not allowed.

6. Open and merge release PR to `main`
- PR title: `🔖 Bump version to <version>`
- PR body must include expected tag (`v<version>`) and verification result.

7. Trigger release explicitly from merged `main`

```bash
git checkout main
git pull --ff-only origin main
git tag v<version>
git push origin v<version>
```

- This tag push is the supported release trigger.
- Do not treat PR merge itself as deployment.

8. Monitor the `RELEASE` workflow
- Example:

```bash
gh run list --workflow RELEASE.yml --limit 5
```

- Wait for npm publish, Docker publish, and manifest jobs to finish.

9. Finalize GitHub Release note
- Open the created release page after `RELEASE` creates it.
- Treat auto-generated notes as a draft only.
- Replace the body with the final note before sharing the release externally.

## 7. Recovery Guide
Use this section when the version bump PR is merged but the release did not start cleanly.

1. Confirm the merged `main` commit

```bash
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
```

2. Confirm whether the tag exists remotely

```bash
git ls-remote --tags origin v<version>
```

3. Confirm whether `RELEASE` started

```bash
gh run list --workflow RELEASE.yml --limit 10
```

4. If the tag exists but no `RELEASE` run started, recreate the tag explicitly

```bash
git checkout main
git pull --ff-only origin main
git push origin :refs/tags/v<version>
git tag -d v<version> 2>/dev/null || true
git tag v<version>
git push origin v<version>
```

5. Re-check release creation

```bash
gh run list --workflow RELEASE.yml --limit 10
gh release view v<version> --json tagName,url,publishedAt
```

## 8. GitHub Release Note Policy
1. Scope
- Applies to every release created from a `v*` tag.

2. Mandatory rule
- Release notes are required for every release.
- Auto-generated notes are not the final version by default.
- The maintainer who pushes the release tag is responsible for the final note.

3. Format by semver type
- Patch release (`X.Y.Z` where only `Z` changes):
  use `What's Changed`
- Minor release (`X.Y.0` where `Y` changes):
  use `What's New`

4. Patch release rule
- Keep `What's Changed` short and user-facing.
- Do not add migration/setup guidance unless the patch requires user action.

5. Minor release rule
- `What's New` must explain:
  what changed, how to use it, and whether the user must take any extra action.
- When configuration, auth, runtime, or startup behavior changes, include exact commands and environment variables.
- When the release changes how users run the product, include concrete examples for the affected distribution methods such as `npx`, `docker run`, and `docker-compose`.
- Use fenced code blocks for commands, `.env` examples, and compose snippets.

6. Investigation rule before writing the note
- Range baseline: previous release tag to current release tag.
- Example: `v0.3.0..v0.3.1` or `v0.2.2..v0.3.0`
- Commit source command:
  `git log v<previous>..v<current-or-HEAD> --pretty=format:"%h %s"`
- PR source command:
  `git log v<previous>..v<current-or-HEAD> --merges --pretty=format:"%s"`
- Investigate the range before writing the note even if the final note is short.

## 9. Release Note Reference
Use the published release page as the source of truth for the final note content.

1. Patch release example
- `gh release view v0.3.1`

2. Minor release example
- `gh release view v0.3.0`

3. Browser links
- `https://github.com/baealex/ocean-brain/releases/tag/v0.3.1`
- `https://github.com/baealex/ocean-brain/releases/tag/v0.3.0`

## 10. Required Secrets
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
