# Ocean Brain integrations

Ocean Brain supports built-in integrations and independently hosted external apps.
MCP is the built-in integration. Keyword and semantic search remain native search
features; external search apps do not replace the search bar or MCP search tool.

## Terminology

**Integrations** connect MCP clients or external apps through approved data access.
An **external app** runs on its own service; Ocean Brain provides access management
and an optional page entry. Registering its manifest does not install or run its code.
**Plugins** refers to installable code packages that Ocean Brain would load and
execute. That runtime is not currently provided.

Routes, source modules, and database models use `integration` terminology.
Settings live at `/setting/integrations`; an app page lives at
`/integrations/:connectionId`. A connection is one registration of an integration:
`connectionId` identifies that registration, while `integrationId` is the stable
manifest identifier shared by registrations of the same app.

## Connect an external app

Open **Settings → Integrations → Connect app**, choose the developer's manifest
JSON file, and approve its requested permissions. A new connection starts disabled. Generate a token,
configure it in the external service, and enable the connection. Tokens are shown
only when generated; replacing or revoking one affects only that connection.

An external app can provide a page that opens from settings. **Show in top bar** adds a
shortcut while the connection is enabled. Disconnecting an external app
revokes its token and removes its entry, without deleting Ocean Brain notes or
attempting to delete the external service's data. The built-in MCP integration can be disabled but
cannot be disconnected. Its existing connection setup page remains available.

Local experiments may be kept under `examples/`, which is excluded from Git.
The API examples below are self-contained and do not require those local apps.

## Build your first integration

An app can use notes, tags, and existing properties as its shared data store:
for example, a capture inbox, task dashboard, or external search index. The API
works with Ocean Brain's note model. App-specific tables, private settings, job
queues, and search indexes belong in the app's own storage. There is no arbitrary
SQL endpoint, app-defined core table API, or per-app private note namespace.

1. Create an independent backend using the HTTP requests and runnable Node example
   below. Node's built-in `fetch` is sufficient; other backend languages can call
   the same HTTP API.
2. Give your app a stable manifest `id`, describe its purpose, and request the
   permissions its features use. Add `launch` for a page; omit it for a background job.
3. Register the manifest in **Settings → Integrations → Connect app**. The owner
   chooses grants and generates a token for this connection.
4. Configure the app backend with `OCEAN_BRAIN_URL` and
   `OCEAN_BRAIN_INTEGRATION_TOKEN`, start it, and enable the connection.
5. Call `GET /api/integrations/v1/me` to check the connection and actual grants.
   Use GraphQL for reads and the note endpoints below for writes. A browser page
   submits to your backend; the backend holds the token and calls Ocean Brain.
6. Open the app from settings. Test with a permission removed, with the connection
   disabled, and after token revocation. Handle denied access in the app UI.

An external app owns its deployment and updates. Deliver its manifest alongside
the service and document how users configure the server URL and connection token.
Registering a new app does not require a core code change or database migration.

## Manifest contract

```json
{
  "schemaVersion": 1,
  "apiVersion": 1,
  "id": "example.note-inbox",
  "name": "Note Inbox",
  "version": "1.0.0",
  "description": "Browse recent notes and capture a new note.",
  "permissions": ["notes:read", "notes:create"],
  "launch": { "url": "http://127.0.0.1:7777", "mode": "iframe" }
}
```

`id` is a stable lowercase identifier; `ocean-brain.*` is reserved for built-in
integrations. Multiple connections of the same external app have independent
credentials and grants. `version` identifies the app's own release.
`schemaVersion` describes the manifest format, and `apiVersion` selects the core
API major version. Currently both must be `1`; unsupported versions are rejected.

`launch` is optional for headless automation. Its mode is `external` or `iframe`.
URLs must be absolute HTTPS URLs without embedded credentials; HTTP is allowed
only for `localhost`, `127.0.0.1`, or `[::1]` during local development. Ocean Brain
reads the submitted manifest; it does not fetch arbitrary manifest URLs or load
third-party code into its server process.

Use **Update app manifest** to update an existing connection. The identifier
cannot change. Previously approved permissions are intersected with the new
request; additional permissions require an explicit grant. Updating a manifest
never requires a database migration or replaces the token.

## Permissions

| Permission | Access |
| --- | --- |
| `notes:read` | All current notes and their content, tags, properties, saved views, and search results |
| `notes:create` | Create notes, including inline tags and existing property values |
| `notes:update` | Edit note Markdown and metadata |
| `notes:delete` | Move notes to Ocean Brain's trash through the existing delete operation |

The settings page shows only permissions listed in the app's manifest. **Note
Inbox requests read and create because it only lists and captures notes.** Update
and delete are available to external apps too; they are not reserved for MCP.

An app that edits and deletes notes can request all four in its manifest:

```json
"permissions": ["notes:read", "notes:create", "notes:update", "notes:delete"]
```

For an existing connection, use **Update app manifest** with the same `id` and the
new permission list. Then explicitly enable **Edit notes** and **Delete notes**.
The existing token can be reused; new requests do not automatically become grants.
Requesting a permission does not add an editor or delete button to the external
app: its developer implements those features and calls the corresponding API.

These are connection-wide permissions, not per-note access rules. Writes also
require `notes:read`, because authoring responses and conflict checks contain note
data. Manifests request permissions; the server authorizes only the grants saved
by the owner. MCP uses the same grant checks, including on legacy routes.

Integration tokens cannot manage connections, mint credentials, or authenticate as a
browser owner. Administrative endpoints use the existing owner session and CSRF
protection. Explicit open mode remains a trusted-local mode with unauthenticated
owner APIs; use password mode when external parties can reach the server. Owner
writes reject foreign and opaque browser origins in open mode, including requests
from sandboxed app pages.

Disabling or revoking stops subsequent API requests. Data already copied to an
external service remains that service's responsibility; permissions do not erase
previous exports.

## Integration API v1

Send `Authorization: Bearer <connection-token>` from the external app’s backend. Keep
it out of page URLs, iframe attributes, browser storage, and distributed frontend
code. No browser session bridge or cross-origin browser API access is provided.

- `GET /api/integrations/v1/me`: authenticated connection identity and granted permissions.
- `POST /api/integrations/v1/graphql`: the read-only data API, requiring `notes:read`.
- `POST /api/integrations/v1/notes/create`: requires `notes:create`.
- `POST /api/integrations/v1/notes/baseline`: requires `notes:read`.
- `POST /api/integrations/v1/notes/metadata`: requires `notes:update`.
- `POST /api/integrations/v1/notes/patch-markdown`: requires `notes:update`.
- `POST /api/integrations/v1/notes/append-markdown`: requires `notes:update`.
- `POST /api/integrations/v1/notes/replace-markdown`: requires `notes:update`.
- `POST /api/integrations/v1/notes/delete`: requires `notes:delete`.

Missing credentials return 401; denied, disabled, or revoked access returns 403.
MCP additionally uses its existing compatibility headers and 426 response.
External apps do not send MCP compatibility headers.

The GraphQL schema exposes an explicit set of queries: `allNotes`, `note`,
`noteRead`, `backReferences`, `notesByTagNames`, `allTags`, `tagsByNames`,
`notePropertyKeys`, `notesByQuery`, `notesByProperties`, `viewSections`,
`readViewSection`, and `searchNotes`. Introspection describes their input/output
types. Browser/admin queries, cache values, and mutations are not in this schema.
Pagination accepts `limit` 1–100 and nonnegative `offset`; omitted pagination uses
25 and 0. Note reads do not persist reference-title changes.

Example read request:

```json
{
  "query": "query Inbox($pagination: PaginationInput!) { allNotes(pagination: $pagination) { totalCount notes { id title contentPreview updatedAt } } }",
  "variables": { "pagination": { "limit": 10, "offset": 0 } }
}
```

Example create request:

```json
{ "title": "Captured externally", "markdown": "A note from my external app." }
```

Create returns `{ "created": true, "note": { ... } }`. For metadata changes,
send `id`, the note's `expectedUpdatedAt`, and the fields to change (`title`,
`layout`, or `properties`). Read the current property definitions before setting
property values. Markdown authoring operations retain the intent, selectors,
version guards, conflict results, and warnings documented in the
[CLI authoring contract](../packages/cli/README.md). Delete accepts `{ "id": "123" }`.

### Backend walkthrough: read, create, update, delete

This Node.js example creates its own note, reads it, renames it, and moves it to
trash. Use a connection whose manifest requests all four permissions and whose
owner has granted them. The unchanged Note Inbox manifest requests only two.

Save the following as `integration-demo.mjs`. Supply `OCEAN_BRAIN_URL` and
`OCEAN_BRAIN_INTEGRATION_TOKEN` in a private `.env`, then run
`node --env-file=.env integration-demo.mjs` from that directory.

```js
const { OCEAN_BRAIN_URL: origin, OCEAN_BRAIN_INTEGRATION_TOKEN: token } = process.env;
if (!origin || !token) throw new Error('Configure the server URL and connection token.');
const base = `${origin.replace(/\/$/, '')}/api/integrations/v1`;

async function api(path, body) {
    const response = await fetch(`${base}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok || result.errors) {
        throw new Error(result.message ?? result.errors?.[0]?.message ?? `HTTP ${response.status}`);
    }
    return result;
}

const identity = await api('/me');
console.log('Granted permissions:', identity.permissions);

const created = await api('/notes/create', {
    title: 'Integration walkthrough',
    markdown: 'Created by my external app.',
});
const read = await api('/graphql', {
    query: 'query Read($id: ID!) { noteRead(id: $id, maxLength: 1000) { note { id title updatedAt } markdown } }',
    variables: { id: created.note.id },
});
const note = read.data.noteRead.note;
const updated = await api('/notes/metadata', {
    id: note.id,
    expectedUpdatedAt: note.updatedAt,
    title: 'Renamed by my external app',
});
if (updated.status !== 'applied') {
    throw new Error(`Update was not applied: ${updated.reason ?? updated.status}`);
}
const deleted = await api('/notes/delete', { id: note.id });
console.log({ created: created.created, updated: updated.status, deleted: deleted.deleted });
```

Metadata and Markdown writes use a version guard so an app can detect intervening
edits. Inspect the write result's `status` even when HTTP succeeds; a conflict is
not a successful edit. Read the note again and let the user reconcile the change.
Deletion moves a note to trash and currently accepts only its ID; it has no
`expectedUpdatedAt` guard. An interactive app should confirm which note to delete.

### Owner management API

The host management API is `/api/integration-admin/connections`: GET returns `{connections: [...]}`, POST
registers `{manifest, grantedPermissions}`, PATCH `/:id` updates grants, enabled,
pinned, or manifest, and DELETE `/:id` disconnects. POST `/:id/token/rotate` returns
one plaintext token, and POST `/:id/token/revoke` revokes it. These endpoints require
owner authentication; an integration cannot approve its own permissions.

## Page isolation

Embedded apps fill the available workspace below a compact host toolbar. The app
owns its responsive layout and document scrolling. Support narrow screens and
light/dark colors in the app itself; the Note Inbox example uses CSS
`prefers-color-scheme` without accessing the host DOM or receiving a session bridge.

Embedded pages use `sandbox="allow-scripts allow-forms"` and `referrerpolicy="no-referrer"`.
They receive no host token or session API bridge. Same-origin pages and HTTP pages
inside an HTTPS host open externally instead. External pages can also decline
embedding through their own CSP; the new-tab link is always available.

The sandbox deliberately does not grant origin/storage access, parent navigation,
or popup capabilities. Apps requiring those capabilities should use external mode.
See the [iframe sandbox reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox)
for browser behavior. The example uses server-rendered forms and keeps the Ocean
Brain credential in its server environment.

## Storage, compatibility, and migration

The platform adds `IntegrationConnection` and `IntegrationCredential` once. Manifests and
grants are validated JSON documents stored as data. External apps own their
settings, indexes, persistence, and migrations; adding or upgrading one does not
add core tables, Prisma enums, routes, or imports. Built-in integration definitions live in a
code registry; startup creates missing connection records without overwriting
existing grants or credentials. Adding a native integration also needs no new
integration-specific table.

Migration `0020` creates the platform records under their original names. Migration
`0021` renames them to `IntegrationConnection` and `IntegrationCredential`, including
the `integrationId` and `connectionId` columns, without replacing IDs, manifests,
grants, enabled/pinned states, credentials, or timestamps. Both run automatically
on a new database; a database already on `0020` only needs the rename.

The initial platform migration creates the built-in MCP integration record, preserves
`MCP_ENABLED`, and copies the latest active MCP token hash and timestamps. Users
do not need to regenerate that token. Thereafter both integration settings and the
legacy MCP administration API use the new records as the single authority.

Token preservation does not preserve the previous tool catalog. This release uses
MCP compatibility `0.12`: upgrade the server and MCP adapter together and reconnect
the client. See the [MCP migration guide](../packages/cli/README.md#migration-to-mcp-compatibility-012)
for removed tools and their replacements.

`/graphql/mcp`, `/api/mcp/*`, and `/api/mcp-admin/*` remain compatibility routes.
The CLI now uses `/api/integrations/v1/*`. The CLI still speaks MCP over stdio; the new
HTTP paths are the application's data API, not an HTTP MCP JSON-RPC endpoint.

Normal server startup applies Prisma migrations. Back up the database before an
upgrade. Legacy MCP tables are retained but stop receiving updates. A rollback to an
older binary must restore a matching pre-upgrade database backup and review/rotate
MCP credentials before exposing the older server; old token records may no longer
match the current revocation state. Do not copy stale token rows back into the new
platform after it has started managing credentials.

Future additive v1 API changes should preserve existing contracts. A breaking
contract needs a new API major version while the old version remains available
for a documented migration window. App-specific configuration versions belong
to the external app, independently of the core manifest and API versions.

This release does not provide an in-process plugin runtime, marketplace, native
search replacement hooks, editor extension hooks, or durable change delivery.
The UI's transient change notifications are not an external synchronization API.
External indexers can poll note IDs and `updatedAt`, fetch changed notes, and
reconcile deletions against a complete ID listing. These reads do not provide a
stable snapshot across pages; an indexer must account for concurrent edits.
Change cursors, deletion tombstones, and event replay are not currently provided.
