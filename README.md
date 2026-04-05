# Ocean Brain

**Self-hosted, open-source Notion alternative** with bi-directional links and privacy-first design.

Own your notes. Connect your thoughts. No cloud required, no subscription needed.

> Just like the vast ocean holds countless treasures, Ocean Brain lets your thoughts flow freely and securely on your own server.

### Why Ocean Brain?

- **Privacy-first**: Your notes stay on your server. No third-party access, ever.
- **Notion-like editor**: Block-based editing powered by [BlockNote](https://www.blocknotejs.org/)
- **Bi-directional links**: Connect notes with `[` and see backlinks instantly
- **Zero subscription**: Self-host once, use forever
- **Quick setup**: One npx or docker command, ready in 30 seconds

## Try it now

**[Live Demo](https://demo-ocean-brain.baejino.com/)** - See Ocean Brain in action

<br>

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

<br>

## Features

| Feature | Description |
|---------|-------------|
| Block editor | Notion-like editing with `/` commands |
| Bi-directional links | Link notes with `[` and track backlinks |
| Knowledge graph | Explore connections between notes visually |
| Tags | Organize with `@` mentions |
| Search | Full-text search across all notes |
| Pin notes | Keep important notes at the top |
| Reminders | Set reminders with priorities |
| Calendar view | See your notes by date |
| MCP server | Integrate with AI tools like Claude Code |

<br>

## MCP Server (AI Integration)

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
| `ocean_brain_read_note` | Read a note by ID |
| `ocean_brain_list_tags` | List tags with note counts |
| `ocean_brain_list_recent_notes` | List recently updated notes |
| `ocean_brain_create_note` / `ocean_brain_update_note` | Create or update notes |
| `ocean_brain_create_tag` / `ocean_brain_delete_note` | Create tags or delete notes (safe write flow) |
