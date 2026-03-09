# Ocean Brain Encoding Convention

Updated: 2026-03-09

## 1. Baseline
- Text files in this repository use `UTF-8` without BOM.
- Line endings use `LF`.
- The repository root `.editorconfig` and `.gitattributes` are the source of truth for editor and checkout behavior.

## 2. Required Rules
1. Save source, config, and documentation files as `UTF-8`.
2. Do not rely on editor-local defaults for charset or line endings.
3. Prefer plain `UTF-8` over Git `working-tree-encoding`.
- `working-tree-encoding` is intentionally not used here because it adds toolchain complexity without a clear project need.
4. Preserve user-visible non-ASCII text only when it is intentional.
- Examples: emoji icons, Korean copy, typographic symbols.
- If a symbol is not part of the intended UI contract, prefer plain ASCII.

## 3. Automated Guardrail
- Run `pnpm check:encoding` before pushing encoding-related changes.
- The check scans tracked text files and fails when:
- a file does not decode as `UTF-8`
- a file contains a UTF-8 BOM
- a file under `packages/client/src` contains the Unicode replacement character `U+FFFD`

## 4. When Fixing Suspect Text
1. Verify whether the issue is in the file bytes or only in local terminal rendering.
2. Fix the smallest affected file set first.
3. Re-save the file as `UTF-8` without BOM only if the bytes are actually damaged.
4. Re-check the visible UI copy after the patch.

## 5. Recommended Verification
- `pnpm check:encoding`
- `pnpm test:ci`
- `pnpm type-check`
- `pnpm build`

## 6. Scope Notes
- This convention is a guardrail for future edits.
- It does not automatically renormalize an existing checkout; that should be handled intentionally if a dedicated cleanup is needed.
