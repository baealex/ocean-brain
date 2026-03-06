# GraphQL Variables Convention

Updated: 2026-03-06

## 1. Purpose
- Prevent query breakage and injection risks caused by string interpolation.
- Standardize API contracts in the client layer.

## 2. Core Rule
- Dynamic GraphQL values must be passed through `variables` only.
- Do not interpolate user/runtime values into GraphQL query strings.

## 3. Required Pattern
1. API layer only
- Compose GraphQL requests only in `packages/client/src/apis/**`.
- Components/pages must call API functions and must not build GraphQL strings directly.

2. Request shape
- Use `graphQuery({ query, variables, operationName })` or equivalent positional arguments.
- Define request and response types at the API function boundary.

3. Dynamic fields
- If dynamic field selection is required, use an allowlist and safe replacement.
- Never inject arbitrary field strings from user input.

4. Error handling
- Handle `response.type === 'error'` in callers.
- Use normalized error fields: `category`, `errors[].code`, `errors[].message`, `errors[].details`.

## 4. Disallowed Example
```ts
graphQuery(`
  query {
    note(id: "${id}") { id title }
  }
`);
```

## 5. Allowed Example
```ts
graphQuery<{ note: { id: string; title: string } }, { id: string }>(
  `query FetchNote($id: ID!) {
    note(id: $id) { id title }
  }`,
  { id }
);
```

## 6. Verification
- Run interpolation scan:
```bash
rg -n "\"\\$\\{.*\\}\"|\\$\\{.*\\}" packages/client/src/apis packages/client/src/pages/Note.tsx
```
- Ensure output is empty for GraphQL request code.

