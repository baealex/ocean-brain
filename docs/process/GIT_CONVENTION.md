# Ocean Brain Git Convention

Updated: 2026-03-06

## 1. Scope
- This document defines commit and PR conventions for the Ocean Brain repository.
- Applies to all code, documentation, and CI/CD changes.

## 2. Commit Convention

### 2-1. Base Format
`<emoji> <subject>`

- `subject` must start with an English verb.
- Capitalized first letter is recommended.
- Do not end with a period.
- One commit should contain one logical change.
- Commit emoji must be a Unicode emoji character (for example `✨`), not shortcode.

### 2-2. Emoji Map
- `✨`: feature addition
- `🐛`: bug fix
- `♻️`: refactor
- `⚡`: performance improvement
- `📝`: documentation change
- `✅`: tests added/updated
- `🛠`: CI/build/config/maintenance
- `🔖`: release/version/package updates
- `🚑`: urgent hotfix

### 2-3. Release Commit
- Release commit format:
- `🔖 Bump version to <version>`
- Example: `🔖 Bump version to 0.2.1`

### 2-4. Disallowed Examples
- `update stuff`
- `✨update stuff`
- `:sparkles: Add feature`
- `WIP`
- Multi-topic commit messages

## 3. PR Convention

### 3-1. Base Rules
- Default target branch: `main`
- Required CI checks: `lint`, `type-check`, `build`
- PR title format: `<emoji> <subject>`
- PR title emoji must be a Unicode emoji character (for example `✨`), not shortcode.
- PR body must follow `.github/PULL_REQUEST_TEMPLATE.md` headings exactly.

### 3-2. Recommended Branch Naming
- `feat/<short-topic>`
- `fix/<short-topic>`
- `chore/<short-topic>`
- `docs/<short-topic>`

### 3-3. Required PR Body Sections
Use the template headings exactly:
- `:dart: Goal`
- `:hammer_and_wrench: Core Changes`
- `:brain: Key Decisions`
- `:test_tube: Verification Guide`
- `:white_check_mark: Checklist`

### 3-4. Pre-Merge Checklist
1. CI checks (`lint`, `type-check`, `build`) pass
2. Local validation for the changed scope is complete
3. Any docs/scripts/env changes are documented in PR body
4. Release-impacting changes include version/tag plan

### 3-5. Release-Impact PR
Changes in the files below are treated as release-impacting.
1. `packages/cli/package.json`
2. `scripts/release/prepublish.mjs`, `scripts/release/bump-version.mjs`
3. `.github/workflows/RELEASE.yml`
4. `Dockerfile`, `docker-compose.yml`

Release-impact PRs must include:
1. expected release version
2. tag plan (`vX.Y.Z`)
3. verification result (`CLI_SMOKE` pass)

### 3-6. Merge Policy
- Default: merge commit
- Squash merge is allowed for single-commit-style changes

### 3-7. PR Submission Guardrail (Required)
Before sharing a PR URL, confirm all of the following:
1. Title follows `<emoji> <subject>` and subject starts with an English verb.
2. Body section headings exactly match the template headings.
3. PR body heading emojis must use shortcode form (`:dart:`, `:hammer_and_wrench:`, etc.).
4. `Verification Guide` contains concrete commands and expected results.
5. The `Checklist` state is intentionally set (not left ambiguous).

## 4. PR Template Path
- Use `.github/PULL_REQUEST_TEMPLATE.md` as the official PR template.

## 5. Deployment and Release Reference
- For deployment/release policy and runbook details, refer to `docs/process/DEPLOYMENT_RELEASE_STRATEGY.md`.
