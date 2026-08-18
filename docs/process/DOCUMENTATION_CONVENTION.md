# Ocean Brain Documentation Convention

Updated: 2026-08-18

## 1. Purpose

Documentation changes should make the product or the contribution workflow easier to understand. The size of a documentation change is not a quality criterion by itself; its audience, source of truth, and measurable clarity are.

Use this document when deciding where new guidance belongs and whether a documentation pull request adds enough value to merge.

Process documents in `docs/process/` include an `Updated: YYYY-MM-DD` line below the title. This is a freshness hint, not a replacement for Git history; update it when the document's meaning changes. User-facing documents such as `README.md` do not need a manual date unless freshness is part of their meaning.

## 2. Document ownership

Keep one authoritative location for each kind of guidance:

| Content | Canonical location | Scope |
| --- | --- | --- |
| Product overview and user-facing quick start | `README.md` | What Ocean Brain is, how to try it, and the shortest supported setup paths |
| Docker usage, networking, storage, and backups | `docs/DOCKER.md` | Docker-specific operation and persistence guidance |
| Package-specific commands and APIs | The relevant package README | Usage that only applies to one package, such as the CLI |
| Development, testing, Git, and release workflows | `docs/process/` | Contributor and maintainer procedures |

Prefer linking to the canonical document over copying the same instructions into another document. Add a short summary to a higher-level document only when it improves discovery for that document's audience.

## 3. Changes worth accepting

A documentation change is generally valuable when it does at least one of the following:

- Corrects information that is wrong, stale, or unsafe.
- Fills a real onboarding or contribution gap.
- Makes an existing authoritative guide easier to discover without duplicating it wholesale.
- Documents a user-visible behavior, supported workflow, or project decision that would otherwise be easy to miss.
- Establishes or clarifies a repeatable project process.

Small changes are welcome when they have one of these outcomes. A large rewrite is not automatically more valuable.

## 4. Changes that need revision or may be declined

Request changes when the underlying idea is useful but the proposal has fixable problems, such as an incorrect command, missing verification, misplaced content, or unrelated formatting churn.

A documentation pull request may be declined or closed when it:

- Restates an existing guide without improving discovery or clarity.
- Reflects only a wording preference with no identifiable reader benefit.
- Adds commands or examples that were not verified in the documented environment.
- Places guidance outside its canonical document and creates competing sources of truth.
- Includes unrelated whitespace or formatting changes that make the intended change harder to review.
- Does not describe a concrete problem, audience, or expected improvement.

Do not decline a change merely because it is small, and do not merge one merely to award contributor credit. Merge based on the value of the resulting documentation.

## 5. Documentation pull request checklist

Before approving a documentation change, check:

- The intended reader and problem are clear.
- The chosen file owns the subject, or links to the document that does.
- Existing guidance was searched for before adding new instructions.
- Commands, URLs, examples, and version requirements were verified.
- The change avoids unrelated whitespace or formatting churn.
- The PR body explains the documentation impact and includes the required verification.
- The release-impact label follows `GIT_CONVENTION.md`.

## 6. Review outcomes

- Use **Request changes** when the idea is useful but the patch needs corrections before merge.
- Use a normal **Comment** for questions or non-blocking suggestions.
- Use **Approve** when the guidance is useful, belongs in the chosen location, and has been verified.
- Close the pull request with a short, specific explanation when it duplicates existing guidance, has no clear reader benefit, or is out of scope.

For a decline, explain the repository rule and point to the canonical document when possible. Keep the decision about the change, not the contributor.
