# Ocean Brain integrations

Ocean Brain supports built-in integrations and separately running integration apps. MCP is the built-in integration. Keyword and semantic search remain native search features; integration search apps do not replace the search bar or MCP search tool.

Integration apps are intended for capabilities that benefit from a separate process or more compute: speech-to-note capture, Elasticsearch or RAG indexes, publishing, backups, automations, and hosted premium services. They can read or author Ocean Brain data and present their own page. A future plugin runtime would cover internal editor commands, panels, themes, and native search replacement instead.

## Terminology

**Integrations** connect MCP clients or apps through approved data access. An **integration app** runs in a separate process; Ocean Brain provides access management and an optional page entry. It can be opened at its own URL or placed behind Ocean Brain's proxied app gateway. Registering its manifest does not install or run its code. **Plugins** refers to installable code packages that Ocean Brain would load and execute. That runtime is not currently provided.

Routes, source modules, and database models use `integration` terminology. Settings live at `/setting/integrations`; an app page lives at `/integrations/:connectionId`. A connection is one registration of an integration: `connectionId` identifies that registration, while `integrationId` is the stable manifest identifier shared by registrations of the same app.

## Connect an external app

Open **Settings → Integrations → Connect app**, choose the developer's manifest JSON file, and approve its requested permissions. A new connection starts disabled. Generate a token, configure it in the external service, and enable the connection. Tokens are shown only when generated; replacing or revoking one affects only that connection.

An external app can provide a page that opens from settings. **Show in top bar** adds a shortcut while the connection is enabled. Disconnecting an external app revokes its token and removes its entry, without deleting Ocean Brain notes or attempting to delete the external service's data. The built-in MCP integration can be disabled but cannot be disconnected. Its existing connection setup page remains available.

Local experiments may be kept under `examples/`, which is excluded from Git. The API examples below are self-contained and do not require those local apps.

## Check connection status and try a first task

Settings → Integrations shows each app’s purpose, current status, and next action without opening its settings. Use **Set up MCP** to connect an AI client, **Continue setup** to finish an external connection, or **Open app** to use a configured app. The gear button opens permissions, credentials, and the **Integration access** switch, consistently labeled **On** or **Off**. Access permission is separate from actual activity. A connection can need setup, have access paused, be waiting for its first API access, or have recorded access. The timestamp records authentication with the current token, not a successful task or proof that the app is still online. Status refreshes every ten seconds while the page is visible; **Refresh status** checks immediately. If refresh fails, the page keeps the last information and marks it as potentially out of date.

After connecting the built-in MCP integration, expand its card and use **Try it with your notes**. Enter a topic, preview and copy the research request, then paste it into your connected AI client. With read and create access, the request asks the client to save a new summary with links to the source notes. With read-only access, it asks for an answer in the conversation without modifying notes. Copying a request does not execute it or confirm a result; open the returned note link to review the actual output.

Apps can optionally report work in progress, completion, or a problem using the status endpoint below. These reports are explicitly attributed to the app. A running report older than five minutes is marked **Progress update overdue**; check the app before retrying because it may still be working. A historical completion report is not a live health check.

## Build your first integration

An app can use notes, tags, and existing properties as its shared data store: for example, a capture inbox, task dashboard, or external search index. The API works with Ocean Brain's note model. App-specific tables, private settings, job queues, and search indexes belong in the app's own storage. There is no arbitrary SQL endpoint, app-defined core table API, or per-app private note namespace.

1. Create an independent backend using the HTTP requests and runnable Node example below. Node's built-in `fetch` is sufficient; other backend languages can call the same HTTP API.
2. Give your app a stable manifest `id`, describe its purpose, and request the permissions its features use. Add `launch` for a page; omit it for a background job.
3. Register the manifest in **Settings → Integrations → Connect app**. The owner chooses grants, enters the server-only private URL for a proxied page, and generates a token for this connection.
4. Configure the app backend with `OCEAN_BRAIN_URL` and `OCEAN_BRAIN_INTEGRATION_TOKEN`, start it, and enable the connection.
5. Call `GET /api/integrations/v1/me` to check the connection and actual grants. Use GraphQL for reads, the note endpoints below for writes, and periodic note catalog reconciliation for a synchronized local index. Add the event stream only when the app needs lower update latency. A browser page submits to your backend; the backend holds the token and calls Ocean Brain.
6. Open the app from settings. Test with a permission removed, with the connection disabled, and after token revocation. Handle denied access in the app UI.

An external app owns its deployment and updates. Deliver its manifest alongside the service and document how users configure the server URL and connection token. Registering a new app does not require a core code change or database migration.

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

`id` is a stable lowercase identifier; `ocean-brain.*` is reserved for built-in integrations. Multiple connections of the same external app have independent credentials and grants. `version` identifies the app's own release. `schemaVersion` describes the manifest format, and `apiVersion` selects the core API major version. Currently both must be `1`; unsupported versions are rejected.

`launch` is optional for headless automation. `external` opens an absolute URL in a new tab, `iframe` embeds an absolute URL, and `proxied` embeds the app through Ocean Brain at `/apps/:connectionId/`. External and iframe URLs must use HTTPS without embedded credentials; HTTP is allowed only for `localhost`, `127.0.0.1`, or `[::1]` during local development. A proxied launch contains only `{ "mode": "proxied" }`. The owner enters its private HTTP(S) origin separately when connecting the app, so the address is stored on the server and is never part of the manifest or management API response. Ocean Brain reads the submitted manifest and does not load app code into its server process.

Use **App settings** to update an existing connection. The identifier cannot change. Previously approved permissions are intersected with the new request; additional permissions require an explicit grant. Updating a manifest never requires a database migration or replaces the token.

## Permissions

| Permission | Access |
| --- | --- |
| `notes:read` | All current notes and their content, tags, properties, saved views, search results, live note events, and the note version catalog |
| `notes:create` | Create notes, including inline tags and existing property values |
| `notes:update` | Edit note Markdown and metadata |
| `notes:delete` | Move notes to Ocean Brain's trash through the existing delete operation |

The settings page shows only permissions listed in the app's manifest. **Note Inbox requests read and create because it only lists and captures notes.** Update and delete are available to external apps too; they are not reserved for MCP.

An app that edits and deletes notes can request all four in its manifest:

```json
"permissions": ["notes:read", "notes:create", "notes:update", "notes:delete"]
```

For an existing connection, use **App settings** with the same `id` and the new permission list. Then explicitly enable **Edit notes** and **Delete notes**. The existing token can be reused; new requests do not automatically become grants. Requesting a permission does not add an editor or delete button to the external app: its developer implements those features and calls the corresponding API.

These are connection-wide permissions, not per-note access rules. Writes also require `notes:read`, because authoring responses and conflict checks contain note data. Manifests request permissions; the server authorizes only the grants saved by the owner. MCP uses the same grant checks, including on legacy routes.

Integration tokens cannot manage connections, mint credentials, or authenticate as a browser owner. Administrative endpoints use the existing owner session and CSRF protection. Explicit open mode remains a trusted-local mode with unauthenticated owner APIs; use password mode when external parties can reach the server. Owner writes reject foreign and opaque browser origins in open mode, including requests from sandboxed app pages.

Disabling or revoking stops subsequent API requests. Data already copied to an external service remains that service's responsibility; permissions do not erase previous exports.

## Integration API v1

Send `Authorization: Bearer <connection-token>` from the integration app’s backend. Keep it out of page URLs, iframe attributes, browser storage, and distributed frontend code. The iframe bridge described below does not expose the owner's browser session or an integration connection token, and it does not turn the data API into a cross-origin browser API.

- `GET /api/integrations/v1/me`: authenticated connection identity and granted permissions.
- `POST /api/integrations/v1/status`: report the app’s latest task status, requiring `notes:read`.
- `GET /api/integrations/v1/events`: optional live note change stream, requiring `notes:read`.
- `POST /api/integrations/v1/graphql`: the read-only data API, requiring `notes:read`.
- `POST /api/integrations/v1/notes/catalog`: keyset-paginated note IDs and versions for reconciliation, requiring `notes:read`.
- `POST /api/integrations/v1/notes/create`: requires `notes:create`.
- `POST /api/integrations/v1/notes/baseline`: requires `notes:read`.
- `POST /api/integrations/v1/notes/metadata`: requires `notes:update`.
- `POST /api/integrations/v1/notes/patch-markdown`: requires `notes:update`.
- `POST /api/integrations/v1/notes/append-markdown`: requires `notes:update`.
- `POST /api/integrations/v1/notes/replace-markdown`: requires `notes:update`.
- `POST /api/integrations/v1/notes/delete`: requires `notes:delete`.

Missing credentials return 401; denied, disabled, or revoked access returns 403. MCP additionally uses its existing compatibility headers and 426 response. External apps do not send MCP compatibility headers.

The GraphQL schema exposes an explicit set of queries: `allNotes`, `note`, `noteRead`, `backReferences`, `notesByTagNames`, `allTags`, `tagsByNames`, `notePropertyKeys`, `notesByQuery`, `notesByProperties`, `viewSections`, `readViewSection`, and `searchNotes`. Introspection describes their input/output types. Browser/admin queries, cache values, and mutations are not in this schema. Pagination accepts `limit` 1–100 and nonnegative `offset`; omitted pagination uses 25 and 0. Note reads do not persist reference-title changes.

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

Create returns `{ "created": true, "note": { ... } }`. For metadata changes, send `id`, the note's `expectedUpdatedAt`, and the fields to change (`title`, `layout`, or `properties`). Read the current property definitions before setting property values. Markdown authoring operations retain the intent, selectors, version guards, conflict results, and warnings documented in the [CLI authoring contract](../packages/cli/README.md). Delete accepts `{ "id": "123" }`.

### App-reported task status

An app backend can send `POST /api/integrations/v1/status` with its connection token:

```json
{ "state": "running", "message": "Reading source notes for your summary." }
```

`state` must be `running`, `succeeded`, or `failed`. `message` is a plain-text, nonempty description of at most 300 characters without control characters. For failures, explain what the user can do next, for example: `Publishing account disconnected. Open the app to reconnect it.` Do not include credentials, private URLs, raw stack traces, or note content. A successful response returns the accepted state and message plus a server-generated `reportedAt` ISO timestamp.

The token determines the connection; the caller cannot select another connection or set the report time. Send running updates at meaningful stages (at least once per minute for long-running tasks), then report success only after verifying the resulting operation. For authoring APIs, an HTTP 200 alone does not mean a write was applied. Report failures with a recovery action. Await reports in order; this endpoint stores the last received report and does not order concurrent jobs.

The owner’s connection response includes `statusReport: {state, message, reportedAt} | null`. One bounded report is persisted on the current credential, with no growing event history. Token rotation or revocation clears it, as do access, manifest, and app address changes. Pinning does not clear it. Existing apps need no changes; without reports the UI shows only setup and authenticated access. This endpoint is an observation channel, not a job runner, durable queue, automatic retry mechanism, or independent verification of the app’s claim.

### Note synchronization

`POST /notes/catalog` is the synchronization baseline and does not require a persistent connection. Poll the complete catalog at an interval appropriate for the app, compare it with local records, fetch missing or changed notes through GraphQL, and remove local records absent from the catalog. Near-real-time search may poll more frequently than publishing or backup jobs; avoid a short fixed interval when the app does not need low latency.

The first request, such as `{ "limit": 500 }`, returns current `{id, updatedAt}` entries ordered by ID, a `propertySchemaHash`, plus `hasMore` and `nextAfterId`; send the returned ID as `{ "afterId": "...", "limit": 500 }` for the next page. If the property schema hash changed, refresh the shared property definitions and any indexed note representation that includes property names or options.

Apps that need changes sooner than their polling interval may also open `GET /events`, an authenticated server-sent event stream for an integration backend. It sends `note.created`, `note.updated`, and `note.deleted` invalidations containing `noteId` and `occurredAt`. Re-read a created or updated note through GraphQL, remove a deleted note from the external store, and debounce repeated events for the same note when an editor is saving frequently.

The stream is deliberately transient. Ocean Brain does not write event rows, retain cursors, or replay `Last-Event-ID`, so normal editing does not grow a change-log table. A server restart, network gap, slow-consumer disconnect, or access change ends the stream. Disabling the connection, removing `notes:read`, rotating the token, or revoking it closes active streams. One connection can keep at most two streams open. Treat the stream as a latency optimization, not as a durable job queue or the sole record of an irreversible action.

When using the stream, open it first and buffer incoming note IDs, read the complete catalog, reconcile the external store, then re-read the buffered IDs before processing live events normally. If the stream disconnects during this sequence, discard the partial run and start it again. Repeat catalog reconciliation after every gap and periodically during long-running connections. This keeps recovery stateless on Ocean Brain while still covering edits and deletions that happen during catalog pagination.

Use a backend HTTP client because the bearer token belongs on the app server. Browser `EventSource` cannot attach the required authorization header and must not receive the long-lived integration token.

### Backend walkthrough: read, create, update, delete

This Node.js example creates its own note, reads it, renames it, and moves it to trash. Use a connection whose manifest requests all four permissions and whose owner has granted them. The unchanged Note Inbox manifest requests only two.

Save the following as `integration-demo.mjs`. Supply `OCEAN_BRAIN_URL` and `OCEAN_BRAIN_INTEGRATION_TOKEN` in a private `.env`, then run `node --env-file=.env integration-demo.mjs` from that directory.

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

Metadata and Markdown writes use a version guard so an app can detect intervening edits. Inspect the write result's `status` even when HTTP succeeds; a conflict is not a successful edit. Read the note again and let the user reconcile the change. Deletion moves a note to trash and currently accepts only its ID; it has no `expectedUpdatedAt` guard. An interactive app should confirm which note to delete.

### Owner management API

The host management API is `/api/integration-admin/connections`: GET returns `{connections: [...]}`, POST registers `{manifest, grantedPermissions, proxyUrl?}`, PATCH `/:id` updates grants, enabled, pinned, manifest, or the private `proxyUrl`, and DELETE `/:id` disconnects. Responses expose only `proxyConfigured`; they never return the private URL. A proxied connection requires an HTTP(S) origin without credentials, a path, query, or fragment. POST `/:id/token/rotate` returns one plaintext token, and POST `/:id/token/revoke` revokes it. These endpoints require owner authentication; an integration cannot approve its own permissions.

## App pages and direct proxy

Embedded apps fill the available workspace below a compact host toolbar. The app owns its responsive layout and document scrolling. Support narrow screens and light/dark colors in the app itself, preferably with CSS `prefers-color-scheme`; an app cannot read or style the host DOM.

An iframe launch loads the manifest URL directly in the browser. It is useful when every browser can reach that URL, but a public Ocean Brain page cannot make another user's browser reach a private service on the Ocean Brain server's `localhost`.

A proxied launch solves that topology mismatch. The browser loads `/apps/:connectionId/` from Ocean Brain, and Ocean Brain forwards the request directly to that connection's private URL. Ocean Brain and the app must share a network path: for example, both processes can use the same host loopback interface, or both containers can use one private Docker network. Relative scripts, styles, fetches, redirects, streaming responses, and WebSocket upgrades stay under the connection subpath. The app should generate relative URLs and honor `X-Forwarded-Prefix`. Ocean Brain removes browser cookies, owner authorization, forwarding headers, app-gateway headers, and unsafe upstream response headers at the boundary.

The sandbox gives the app an opaque browser origin. Module scripts and other CORS-enabled subresources must opt into credentials so the short-lived connection cookie reaches the gateway, and the app response must allow the opaque `null` origin with credentials. For example, use `crossorigin="use-credentials"` on module scripts and stylesheets. Vite's production HTML defaults to anonymous `crossorigin`, so a proxied Vite app must replace that attribute or provide an equivalent credentialed asset loader.

The owner configures a private URL such as `http://127.0.0.1:7778` on the connection. A browser request for `/apps/:connectionId/search` becomes a direct server request for `http://127.0.0.1:7778/search`. Ocean Brain supplies trusted `X-Ocean-Brain-Integration-Id`, `X-Ocean-Brain-Connection-Id`, `X-Forwarded-Host`, `X-Forwarded-Proto`, and `X-Forwarded-Prefix` headers. There is no App Runner, global runner port, runner environment variable, or shared runner secret.

Proxied mode is a direct reverse-proxy and isolation contract, not an installer. The current release does not pull images, create containers, allocate storage, or supervise app processes. A future installer can create the app process and save its resulting private URL without changing the public `/apps/:connectionId/` route.

Direct iframe pages use `sandbox="allow-scripts allow-forms"`. Proxied pages add downloads and modal dialogs but still omit `allow-same-origin`, parent navigation, popups, and unrestricted storage. Both use `referrerpolicy="no-referrer"`. Same-origin iframe targets and HTTP targets inside an HTTPS host open externally. An app can also decline direct embedding with its own CSP.

### Iframe bridge v1

Every embedded app can use a small `postMessage` bridge for host navigation and history. This is a UI bridge; note content still comes from the integration API through the app backend.

| Direction | Message | Purpose |
| --- | --- | --- |
| App → host | `{ type: "ocean-brain:app-ready", version: 1 }` | Start bridge negotiation after the app installs its message listener. |
| Host → app | `{ type: "ocean-brain:host-context", version: 1, capabilities: ["location", "open-note"], location }` | Confirm the host and provide the current relative app location. |
| App → host | `{ type: "ocean-brain:location-change", version: 1, location }` | Add app state to Ocean Brain's browser history. |
| Host → app | `{ type: "ocean-brain:location", version: 1, location }` | Restore app state after browser back or forward. |
| App → host | `{ type: "ocean-brain:open-note", version: 1, noteId }` | Open the actual Ocean Brain note page. |
| Host → proxied app | `{ type: "ocean-brain:app-access", version: 1, token }` | Supply a short-lived grant for browser requests through this proxied connection path. |

The app location is a relative path, query, and optional fragment beginning with `/`, such as `/?query=coral&tag=research&page=2`. Ocean Brain stores it in the host route's `app` query parameter. When a user changes a meaningful view state, the app sends `location-change`; when it receives `location`, it restores controls and results without reloading the iframe. Avoid emitting an entry for every keystroke. Use submitted searches, filter changes, selected records, and pagination as history boundaries.

Apps must install their listener before sending `app-ready`, accept bridge messages only when `event.source === window.parent`, and check `version === 1`. The host accepts messages only from the rendered iframe's `contentWindow` and its opaque sandbox origin. App locations are length-limited, normalized, and rejected when they contain a scheme, backslash, encoded slash, or dot traversal segment.

```js
window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.data?.version !== 1) return;
    if (event.data.type === 'ocean-brain:location') restoreAppState(event.data.location);
    if (event.data.type === 'ocean-brain:host-context') restoreAppState(event.data.location);
});

window.parent.postMessage({ type: 'ocean-brain:app-ready', version: 1 }, '*');

function publishSearch(location) {
    window.parent.postMessage({ type: 'ocean-brain:location-change', version: 1, location }, '*');
}

function openNote(noteId) {
    window.parent.postMessage({ type: 'ocean-brain:open-note', version: 1, noteId }, '*');
}
```

The proxied `app-access` value is not an integration token and cannot call `/api/integrations/v1/*`. It is bound to one connection, expires quickly, and belongs only in requests back through that app's `/apps/:connectionId/` path. The app backend continues to hold its long-lived integration token and enforce its own user or connection isolation.

## Storage, compatibility, and migration

The platform adds `IntegrationConnection` and `IntegrationCredential` once. Manifests and grants are validated JSON documents stored as data. External apps own their settings, indexes, persistence, and migrations; adding or upgrading one does not add core tables, Prisma enums, routes, or imports. Built-in integration definitions live in a code registry; startup creates missing connection records without overwriting existing grants or credentials. Adding a native integration also needs no new integration-specific table. Live note events remain in memory and the catalog reads the existing `Note` table, so synchronization adds no event-log migration or retained event storage.

Migration `0020` creates the platform records under their original names. Migration `0021` renames them to `IntegrationConnection` and `IntegrationCredential`, including the `integrationId` and `connectionId` columns, without replacing IDs, manifests, grants, enabled/pinned states, credentials, or timestamps. Migration `0022` adds the shared private proxy URL field. It converts the unreleased `managed` launch experiment to `proxied` and disables those connections until the owner enters a private URL. Migration `0023` adds a nullable status report to the current credential; existing connections and tokens are preserved. These migrations run automatically; installing or upgrading an individual integration app does not add another core migration.

The initial platform migration creates the built-in MCP integration record, preserves `MCP_ENABLED`, and copies the latest active MCP token hash and timestamps. Users do not need to regenerate that token. Thereafter both integration settings and the legacy MCP administration API use the new records as the single authority.

Token preservation does not preserve the previous tool catalog. This release uses MCP compatibility `0.14`: upgrade the server and MCP adapter together and reconnect the client. See the [MCP migration guide](../packages/cli/README.md#migration-to-mcp-compatibility-014) for removed tools and their replacements.

`/graphql/mcp`, `/api/mcp/*`, and `/api/mcp-admin/*` remain compatibility routes. The CLI now uses `/api/integrations/v1/*`. The CLI still speaks MCP over stdio; the new HTTP paths are the application's data API, not an HTTP MCP JSON-RPC endpoint.

Normal server startup applies Prisma migrations. Back up the database before an upgrade. Legacy MCP tables are retained but stop receiving updates. A rollback to an older binary must restore a matching pre-upgrade database backup and review/rotate MCP credentials before exposing the older server; old token records may no longer match the current revocation state. Do not copy stale token rows back into the new platform after it has started managing credentials.

Future additive v1 API changes should preserve existing contracts. A breaking contract needs a new API major version while the old version remains available for a documented migration window. App-specific configuration versions belong to the external app, independently of the core manifest and API versions.

This release does not provide an in-process plugin runtime, marketplace, native search replacement hooks, editor extension hooks, outbound webhooks, or durable change replay. The authenticated integration event stream is the supported live synchronization signal; the browser UI's own transient notifications are not an external API. The note catalog is not a frozen historical snapshot, which is why consumers connect the stream before catalog pagination and repeat reconciliation after a gap. Change cursors and retained deletion tombstones are not provided.
