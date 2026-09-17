<!--
npm package README for the public ocean-brain CLI.

Keep the product overview in the repository README. This file owns the public
`serve` and `mcp` command interfaces, including npx auth and storage behavior.
-->

# ocean-brain CLI

The npm distribution for [Ocean Brain](https://github.com/baealex/ocean-brain). It provides two commands:

- `ocean-brain serve` runs the packaged Ocean Brain web app and server.
- `ocean-brain mcp` connects an MCP client to a running Ocean Brain instance over stdio.

For the product overview and screenshots, see the [Ocean Brain project](https://github.com/baealex/ocean-brain#readme).

## Requirements

Use Node.js 22.13+ or a newer LTS release. A global installation is not required; the examples below use `npx`.

## `serve`

`serve` is the default command, so `npx ocean-brain` and `npx ocean-brain serve` are equivalent.

For a password-protected workspace, set both the shared workspace password and a separate session secret:

```bash
OCEAN_BRAIN_PASSWORD='choose-a-strong-password' \
OCEAN_BRAIN_SESSION_SECRET='paste-a-long-random-secret-here' \
npx -y ocean-brain serve --host 127.0.0.1
```

Open <http://localhost:6683>. Generate the session secret once—for example with `openssl rand -hex 32`—keep it private, and reuse it across restarts. Startup fails unless password mode or open mode is selected explicitly; do not enable both.

One running instance is one shared workspace. Password mode protects the entire instance with one shared password; it does not provide individual accounts, roles, or per-note permissions. If you bind beyond localhost, keep password mode enabled and place Ocean Brain behind HTTPS.

### Local-only open mode

Open mode has no login. Use it only on your own machine and keep the loopback binding:

```bash
npx -y ocean-brain serve \
  --host 127.0.0.1 \
  --allow-insecure-no-auth
```

### Options and environment

| Setting | Behavior |
|---|---|
| `-H, --host <host>` | Bind address; defaults to `0.0.0.0` |
| `-p, --port <port>` | Listen port; defaults to `6683` |
| `--allow-insecure-no-auth` | Explicitly enable open mode |
| `HOST`, `PORT` | Override their corresponding CLI options |
| `OCEAN_BRAIN_PASSWORD` | Shared password for password mode |
| `OCEAN_BRAIN_SESSION_SECRET` | Session secret required in password mode |
| `OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH=true` | Environment equivalent of the open-mode flag |
| `OCEAN_BRAIN_DATA_DIR` | Data directory; defaults to `~/.ocean-brain/data` |
| `OCEAN_BRAIN_IMAGE_DIR` | Uploaded-image directory; defaults to `~/.ocean-brain/assets/images` |
| `DATABASE_URL` | SQLite file URL; takes precedence over the database path derived from the data directory |

By default, notes are stored in `~/.ocean-brain/data/db.sqlite3` and uploaded images in `~/.ocean-brain/assets/images`. The CLI creates the directories and applies bundled database migrations at startup. Stop Ocean Brain and back up both paths together; restore them while the server remains stopped.

Configure the embedding API URL and optional API key under `Settings > Search`. The saved key stays on the server and is not returned to the browser.

Deleted notes remain in Trash for 30 days. Note snapshots are retained for up to 7 days, with at most 10 snapshots per note. These recovery tools and individual exports do not replace a full backup.

For a long-lived installation, replace `ocean-brain` in the commands with an exact version such as `ocean-brain@X.Y.Z`.

## `mcp`

The `mcp` command starts the built-in stdio MCP adapter that forwards tool calls to an existing Ocean Brain instance. It does not start the web app.

The MCP tools can search and read notes, query tags and properties, create notes, make targeted Markdown or metadata edits, and move notes to Trash.

### Tools and response contracts

The default catalog contains 13 tools. All names start with `ocean_brain_`:

| Tools | Purpose |
| --- | --- |
| `search_notes` | Keyword/semantic search, with preview, match flags and a lexical excerpt when available |
| `query_notes` | Recent notes or combined tag/property conditions; no body loading |
| `read_note` | Metadata, Markdown ranges/sections, and back references |
| `list_tags`, `list_properties` | Discover tags in use and existing property definitions/options |
| `list_views`, `read_view` | Discover saved sections and read list/table/board/calendar results |
| `create_note` | Create Markdown and existing property values together |
| `append_note_markdown`, `patch_note_markdown`, `replace_note_markdown` | Append, target a local change, or intentionally replace a body |
| `update_note_metadata` | Change title/layout/property values with an expected version |
| `delete_note` | Move a note to Trash |

Every successful JSON tool response has both `structuredContent` and equivalent JSON text. `read_note` keeps human-readable Markdown text and exposes `{note, markdown, backReferences, contentRange, status}` in `structuredContent`. Code consumers should use `result.structuredContent`; do not JSON-parse `read_note` text. Check `isError` before using any result. Failed writes and ambiguous targets set `isError: true`; recovery candidates remain in the structured result. Applied Markdown writes include `warnings`, including tag/reference count decreases under the `warn` policy. The preserve policies guard counts, not the identity of individual tags or links.

Page limits must be positive integers; offsets must be nonnegative integers. Oversized limits are capped at 50 for search, query and views, or 100 for tag/property discovery. Responses include the applied limit and next offset under `page`. These are live offset pages, not a frozen snapshot of the database.

`query_notes` with `{}` returns 20 recently updated notes. Supply `tagNames` for one or more tags (`project` and `@project` are equivalent); `mode` combines only tags. Property filters always use AND. All view operators are supported: `equals`, `notEquals`, `contains`, `notContains`, `before`, `after`, `exists`, `notExists`. Negative value comparisons require the property to exist; use `notExists` for missing values. `contains`/`notContains` apply to text/URL and `before`/`after` to dates/numbers. Only requested `propertyKeys` are returned; the default is no properties. Unknown tag names appear in `missingTags`.

For example, pass this to `ocean_brain_query_notes` after discovering the property definition:

```json
{
  "tagNames": ["project"],
  "propertyFilters": [{"key": "state", "valueType": "select", "operator": "equals", "value": "doing"}],
  "propertyKeys": ["state"],
  "limit": 20
}
```

`list_views` searches section/tab titles and returns stable section IDs, including distinct sections with the same title. `read_view` returns saved settings and paged rows without changing the active tab. Tables use their saved property columns unless `propertyKeys` is supplied. Boards return the grouping property, options and each row's group; omit `groupValue` for all columns or pass `null` for unclassified notes. Calendars require `dateRange: {"start":"2026-09-01","end":"2026-10-01"}`: start is inclusive, end exclusive, and the range cannot exceed 32 days. Results use the saved date field and are paginated in the database. `section.limit` is the saved UI display count; `page.limit` is the requested result count.

`read_note` defaults to 1,000 UTF-16 code units. Use `offset` to continue or `heading` for an exact Markdown heading; these options are mutually exclusive. Repeated headings return candidates with `start`/`end` positions. `contentRange` reports the returned range, full length, selected section end and next offset. Pass the returned `note.updatedAt` unchanged as `expectedUpdatedAt` on later pages to detect intervening edits. For section continuation, bound `maxLength` by `sectionEnd - nextOffset`. Boundaries avoid splitting emoji surrogate pairs; a one-unit page can therefore return two units. `maxLength: 0` reads the remaining document or entire selected section. Back references remain included on every page. Search excerpt offsets refer to extracted visible text, not editable Markdown positions.

`create_note` accepts `properties: {"set":[{"key":"state","value":"todo"}]}` using the same value format as metadata edits. Definitions and select options must already exist. Validation failures leave no partial note; note and property persistence share a transaction. Markdown `[@tag]` tokens create tags as needed. Body edits retain version/hash checks and pre-edit snapshots.

### Migration to MCP compatibility 0.14

Update the server and MCP adapter together, then reconnect the host so it refreshes the tool catalog. Earlier compatibility clients are rejected with an upgrade message. The MCP compatibility version is a separate contract from the npm package version, but this release intentionally aligns both at 0.14.0.

`oceanBrain.mcpCompatibilityVersion` identifies the MCP contract, not a minimum npm package version. The server accepts adapters whose compatibility major and minor numbers match its own, regardless of the app release number. An app release alone does not change this value; incompatible MCP contract changes do.

| Removed tool suffix | Replacement |
| --- | --- |
| `list_notes_by_tag` | `query_notes` with `tagNames: [tag]` |
| `list_notes_by_tags` | `query_notes` with `tagNames` and `mode` |
| `list_recent_notes` | `query_notes` with no filters (default limit changes from 10 to 20) |
| `query_notes_by_properties` | `query_notes`; specify `propertyKeys` for values previously requested via `includeProperties` |
| `create_tag` | Include `[@tag]` in note Markdown |
| `find_note_cleanup_candidates` | Search/query, read relevant candidates, then use `delete_note` for the selected IDs |

Removed names are not retained as hidden catalog aliases. View/definition editing, batch reads/writes and trash restoration are outside this catalog.

### Connect an MCP client

Open `Settings > Integrations`, expand MCP, and choose `MCP connection setup`. Enable MCP access, issue a token, and save it to a local file. Then configure the MCP client, for example:

```json
{
  "mcpServers": {
    "ocean-brain": {
      "command": "npx",
      "args": [
        "-y",
        "ocean-brain",
        "mcp",
        "--server",
        "http://localhost:6683",
        "--token-file",
        "/absolute/path/to/ocean-brain/mcp-token"
      ]
    }
  }
}
```

Set `--server` to the Ocean Brain URL reachable from the machine running the MCP client. Replace `localhost` when the instance is remote or behind a proxy.

### Options

| Option | Behavior |
|---|---|
| `-s, --server <url>` | Ocean Brain server URL; defaults to `http://localhost:6683` |
| `--token-file <path>` | Read the bearer token from a file; takes precedence over `--token` |
| `--token <token>` | Direct bearer-token fallback |

The built-in adapter expands token-file paths that begin with `~`, `$HOME`, `${HOME}`, `%USERPROFILE%`, or `%HOME%`. This keeps copied JSON configurations portable even when the MCP client does not run arguments through a shell. `Settings > MCP` can generate either macOS/Linux shell commands or Windows PowerShell commands.

Prefer `--token-file` so the token is not stored directly in client configuration. Ocean Brain keeps one active MCP token; rotating or revoking it immediately invalidates the previous token. For a long-lived MCP setup, pin an npm package version compatible with the requirement shown on the MCP connection setup page.

## Links

- [Product documentation](https://github.com/baealex/ocean-brain#readme)
- [Releases](https://github.com/baealex/ocean-brain/releases)
- [Source code](https://github.com/baealex/ocean-brain)
- [Issues](https://github.com/baealex/ocean-brain/issues)
- [MIT License](https://github.com/baealex/ocean-brain/blob/main/LICENSE)

### Built-in MCP integration

MCP is a built-in Ocean Brain integration. Manage its read/create/edit/delete permissions in **Settings → Integrations**, and use the MCP connection setup page for client configuration. Existing tokens are preserved by the platform migration. The CLI uses `/api/integrations/v1/graphql` and `/api/integrations/v1/notes/*`; legacy MCP routes remain server-side aliases with the same permission checks. These HTTP APIs carry application requests; MCP transport remains stdio.

External apps use the same scoped API without MCP compatibility headers. They run independently; registering a manifest does not install or execute their code. See the [integration developer guide](../../docs/INTEGRATIONS.md) for runnable API examples.
