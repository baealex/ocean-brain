# Ocean Brain Query Key Convention

Updated: 2026-03-06

## 1. Scope
- Applies to all React Query `queryKey` and `invalidateQueries` usage in `packages/client`.

## 2. Required Rules
1. Generate all keys only from `packages/client/src/modules/query-key-factory.ts`.
2. Use `as const` tuple keys from factory functions.
3. Do not use nested array keys.
   - Disallowed: `queryKey: [queryKeys.notes.pinned()]`
   - Allowed: `queryKey: queryKeys.notes.pinned()`
4. Do not hardcode string array keys in component/hook/page files.
5. Use object-based params for key payloads (stable shape), not positional spread patterns like `Object.values(...)`.

## 3. Invalidate Strategy
- Use `exact: true` when invalidating one exact cache entry.
- Use `exact: false` when invalidating a key namespace/prefix.
- Prefix helpers (`*.listAll()`, `*.noteAllPages()`) must be used for broad invalidation.

## 4. FE-002 Invalidate Policy Map
| Domain | Trigger | Key | Match |
| --- | --- | --- | --- |
| Notes | pin/delete | `queryKeys.notes.listAll()` | prefix |
| Notes | pin/delete | `queryKeys.notes.tagListAll()` | prefix |
| Notes | pin/delete/reorder | `queryKeys.notes.pinned()` | exact |
| Reminders | create/update/delete | `queryKeys.reminders.noteAllPages(noteId)` | prefix |
| Reminders | create/update/delete | `queryKeys.reminders.upcomingAllPages()` | prefix |
| Reminders | create/update/delete | `queryKeys.reminders.inDateRangeAll()` | prefix |
| Images | delete | `queryKeys.images.listAll()` | prefix |
| Placeholders | create/delete | `queryKeys.placeholders.listAll()` | prefix |
| UI cache | hero banner set/remove | `queryKeys.ui.heroBanner()` | exact |

## 5. Review Checklist
- No `queryKey: [` hardcoded arrays outside factory.
- No `Object.values` based key generation.
- No nested query keys.
- `invalidateQueries` includes explicit `exact` intent.
