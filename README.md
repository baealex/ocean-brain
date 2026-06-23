# Ocean Brain

**A self-hosted writing space for connected notes.**

Write in the browser, link notes together, and keep the workspace on your own server.

Ocean Brain is inspired by Zettelkasten-style note taking: small notes, deliberate links, and ideas that can build on each other over time.

## What it is

Ocean Brain focuses on the writing experience first, then adds enough structure to keep notes connected: links, backlinks, tags, saved views, graph navigation, search, reminders, and calendar views.

It is meant for project notes, decisions, research, learning notes, and ideas you expect to revisit.

## Why connected notes?

A note is easier to reuse when it points to related notes.

Ocean Brain keeps that connection close to the writing flow. You can write a note, link it to another note, and later follow backlinks or views to see where that idea has been used.

## Try it now

**[Live Demo](https://demo-ocean-brain.baejino.com/)** - Try the hosted demo

The hosted demo runs in local-only mode: your edits stay in your browser, so feel free to create, edit, delete, and reset notes while testing.

## Quick Start

`npx ocean-brain` / `docker run baealex/ocean-brain` now require explicit auth configuration.
Choose one of the two modes below:

### npx

```bash
npx ocean-brain serve --allow-insecure-no-auth
```

Local/trusted only (no auth).  
For password mode:

```bash
OCEAN_BRAIN_PASSWORD=change-me \
OCEAN_BRAIN_SESSION_SECRET=replace-with-long-random-secret \
npx ocean-brain serve
```

Open `http://localhost:6683` after startup.

### Docker

The examples below use Docker's default floating tag (`latest`) for quick trials.
For production, pin an exact image tag such as `baealex/ocean-brain:<version>`.

No auth (local/trusted only):

```bash
docker run -d \
    -e OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH=true \
    -v ./assets:/assets \
    -v ./data:/data \
    -p 6683:6683 \
    baealex/ocean-brain
```

Password mode:

```bash
docker run -d \
    -e OCEAN_BRAIN_PASSWORD=change-me \
    -e OCEAN_BRAIN_SESSION_SECRET=replace-with-long-random-secret \
    -v ./assets:/assets \
    -v ./data:/data \
    -p 6683:6683 \
    baealex/ocean-brain
```

If neither password env vars nor `OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH=true` is set, startup fails by design.

### From Source

```bash
pnpm install
pnpm build
OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH=true pnpm start
```

Local/trusted only (no auth).  
For password mode:

```bash
pnpm install
pnpm build
OCEAN_BRAIN_PASSWORD=change-me \
OCEAN_BRAIN_SESSION_SECRET=replace-with-long-random-secret \
pnpm start
```

### Local Development (5173 + 6683)

When using `pnpm dev` in password mode, set password/session env values:

```bash
OCEAN_BRAIN_PASSWORD=change-me \
OCEAN_BRAIN_SESSION_SECRET=replace-with-long-random-secret \
pnpm dev
```

PowerShell:

```powershell
$env:OCEAN_BRAIN_PASSWORD="change-me"
$env:OCEAN_BRAIN_SESSION_SECRET="replace-with-long-random-secret"
pnpm dev
```

If you run server/client in separate terminals, only the server terminal needs password/session env values.

## Core features

| Area | What it does |
|------|--------------|
| Writing | Write and edit notes from a browser-based workspace with block editing and `/` commands |
| Connected notes | Link notes with `[[Note Title]]`, backlinks, tags, saved views, and graph navigation |
| Returning to notes | Use search, pinned notes, reminders, and calendar views to revisit past notes |
| Self-hosted operation | Run the app yourself and keep the database and assets with your instance |

## Data, recovery, and backups

Ocean Brain provides everyday recovery paths, but it is not a replacement for regular backups.

- Deleted notes can be recovered from Trash for a limited time.
- Recent note snapshots can help recover from common editing mistakes.
- Individual notes can be exported as Markdown or as an HTML ZIP with local image asset copies.
- In password mode, uploaded image asset URLs require an authenticated session, just like the workspace.
- For full-instance safety, back up the database and assets used by your deployment.

## MCP Server

Ocean Brain includes a built-in [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server for AI tool integration.

### Setup

1. Open `Settings > MCP` in Ocean Brain.
2. Turn on **Allow MCP access**.
3. Click **Rotate token**.
4. Recommended: save the token to a local file and use `--token-file`.
5. Optional: for quick local setup, pass token directly with `--token`.
6. If your public/proxy host differs from the current app origin, edit the server URL before registering.

Example Claude Code `.mcp.json`:

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
        "/path/to/token.txt"
      ]
    }
  }
}
```

> The service keeps a single active MCP token. Rotating token invalidates the previous token immediately.  
> `--token-file` is recommended for safety, but `--token <value>` is also supported.

### Available Tools

| Tool | Description |
|------|-------------|
| `ocean_brain_search_notes` | Search notes by keyword |
| `ocean_brain_read_note` | Read a note by ID, including tags, properties, and back references |
| `ocean_brain_list_tags` | List tags with note counts |
| `ocean_brain_list_properties` | List shared property definitions, types, and select options |
| `ocean_brain_query_notes_by_properties` | Query notes with property filters |
| `ocean_brain_list_recent_notes` | List recently updated notes |
| `ocean_brain_create_note` / `ocean_brain_update_note` | Create or update notes |
| `ocean_brain_create_tag` / `ocean_brain_delete_note` | Create tags or delete notes (safe write flow) |

## License

Ocean Brain is licensed under the [MIT License](./LICENSE).
