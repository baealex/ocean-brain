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

## 2. Versioned Install and Run Rules (Docker + npx)
1. Production (reproducible)
- npx: `npx ocean-brain@<exact-version>` (example: `npx ocean-brain@0.2.0`)
- Docker: `baealex/ocean-brain:<exact-version>` (example: `baealex/ocean-brain:0.2.0`)
- Do not use floating `latest` in production.

2. Fast trial/development
- npx: `npx ocean-brain` (or `npx ocean-brain@latest`)
- Docker: `baealex/ocean-brain:latest`
- Accepts potential behavior drift over time.

3. Rollback target
- npx: `npx ocean-brain@<previous-version>`
- Docker: `baealex/ocean-brain:<previous-version>`

## 3. Release Trigger
- GitHub Actions `RELEASE` runs only on `v*` tag pushes.
- Example: `v0.2.1`
- Every tag release (`vX.Y.Z`, for example `v0.2.0`) must include a written GitHub Release note at:
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
- Required: latest `CLI_SMOKE` workflow is green for the release target commit/PR.

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

5. Commit version bump (release-only scope)
- `git add packages/cli/package.json`
- `git commit -m "<release-emoji> Bump version to <version>"`
- Version bump must be a separate PR (direct merge/push to `main` is not allowed).

6. Open and merge release PR to `main`
- PR title: `<release-emoji> Bump version to <version>`
- PR body must include expected tag (`v<version>`) and verification result.

7. Tag from merged `main` and push tag
- `git checkout main && git pull`
- `git tag v<version>`
- `git push origin v<version>`

8. After tag push
- `RELEASE` automatically publishes npm + Docker artifacts.

9. Finalize GitHub Release note
- Open the created release page (`https://github.com/baealex/ocean-brain/releases/tag/v<version>`).
- Treat auto-generated notes as draft only; edit and finalize before sharing the release.
- If additional commits were merged after initial investigation, rerun range checks and refresh the note.

## 7. GitHub Release Note Policy (Required)
1. Scope
- Applies to every release created from a `v*` tag.
- Example: `v0.2.0` release page.

2. Mandatory rule
- Release notes are required for every release.
- Auto-generated notes are not the final version by default.
- The maintainer who creates/pushes the release tag is responsible for final note quality.

3. Required sections
- The note must follow section names from `.github/PULL_REQUEST_TEMPLATE.md` and include:
  `Goal`, `Core Changes`, `Key Decisions`, `Verification Guide`.
- For release context, also include:
  `Risks`, `Unreleased Commits`, `Merged PRs`.
- Include rollback guidance for Docker and npm/npx.

4. Completeness rule (commit + PR based)
- Range baseline: previous release tag to current release tag.
  Example: `v0.2.0..v0.2.1` (or `v0.2.0..HEAD` before tagging).
- Commit source command:
  `git log v<previous>..v<current-or-HEAD> --pretty=format:"%h %s"`
- PR source command (merge commits):
  `git log v<previous>..v<current-or-HEAD> --merges --pretty=format:"%s"`
- Investigate and list all unreleased commits and merged PRs without omission.
- If a commit has no PR, keep it under `Unreleased Commits` as a direct commit.

## 8. Release Note Template
Use this template when editing a release like `v0.2.0`.

```md
## Goal
- Why this release exists.
- User-visible outcome.

## Core Changes
- Feature/fix 1
- Feature/fix 2
- Internal or infra change (if relevant)

## Key Decisions
- Major decisions made in this release.
- Alternatives considered and why they were not selected.

## Verification Guide
### How to verify
  - `CLI_SMOKE` workflow passed
  - `pnpm build`

### Expected result
  - Passed/Failed + short note

## Risks
- Breaking changes: Yes/No (details if Yes)
- Known limitations:
  - ...

## Unreleased Commits
- `<short-hash>` `<subject>`
- ...

## Merged PRs
- `#<number>` <title or merge subject>
- ...

## Rollback
- Docker: redeploy `baealex/ocean-brain:<previous-version>`
- npm/npx: run `npx ocean-brain@<previous-version>`

## Links
- Release: `https://github.com/baealex/ocean-brain/releases/tag/vX.Y.Z`
- Compare: `https://github.com/baealex/ocean-brain/compare/vX.Y.(Z-1)...vX.Y.Z`
```

## 9. Current Unreleased Changes Snapshot (Since `v0.2.0`)
Checked at document update time (`2026-03-06`) using:
- `git log v0.2.0..HEAD --pretty=format:"%h %s"`
- `git log v0.2.0..HEAD --merges --pretty=format:"%s"`

1. Unreleased commits
- `999310a` `Add deployment strategy reference in git convention`
- `dcd0ecd` `Refine pull request template structure`
- `b5f8658` `Update bump-version release commit message`
- `dc722ab` `Add process conventions and PR template`
- `9ccac01` `Merge pull request #49 from baealex/fix/native-arm64-runner`
- `e88075c` `Remove paths filter from CI workflow`
- `bd06dce` `Use native arm64 runner for Docker builds`

2. Merged PRs
- `#49` `Merge pull request #49 from baealex/fix/native-arm64-runner`

## 10. Required Secrets
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
