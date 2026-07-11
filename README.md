<img src="./packages/client/public/icon.png" alt="Ocean Brain logo: a brain resting on ocean waves" width="112" />

# Ocean Brain

**A self-hosted writing space for connected notes.**

The editor comes first. Capture a note in the browser, connect it to other notes as the thought develops, and keep writing. Incoming references become backlinks automatically. Tags, properties, saved views, and the graph are there when the notes need more structure.

Ocean Brain works well for project decisions, research trails, meeting notes, learning notes, and ideas that are not finished yet.

[Try the live demo](https://demo-ocean-brain.baejino.com/) · [Run Ocean Brain](#run-ocean-brain)

The demo keeps workspace edits in your browser. It does not include server-backed features such as note snapshots or MCP access.

## How notes grow

- **Write first.** Use the block editor and `/` commands without deciding the final structure up front.
- **Connect as you go.** Reference notes by title, follow backlinks, or step out into the graph when a thread gets larger.
- **Add structure when it helps.** Use tags and typed properties, then filter notes into saved list or table views.
- **Find the work again.** Search the workspace, pin active notes, set reminders, or find notes by date in the calendar.

Notes can be copied as Markdown or downloaded as Markdown or HTML. Local image assets can be bundled with an export when the document needs to stand on its own.

## Run Ocean Brain

One Ocean Brain instance is one shared workspace. Password mode protects the whole instance with a single shared password; it does not provide individual accounts, roles, or per-note permissions.

Ocean Brain will not start until you explicitly choose password mode or open mode. The two modes cannot be enabled together.

### Private local trial

With Node.js 22 installed, the shortest path to a private local trial is `npx`. Open mode has no login, so keep it bound to your own machine:

```bash
HOST=127.0.0.1 \
PORT=6683 \
npx ocean-brain serve --allow-insecure-no-auth
```

Open <http://localhost:6683>. Notes and uploaded images are stored under `~/.ocean-brain` and remain there across restarts.

### Password mode with npx

Password mode needs both a workspace password and a separate session secret. Generate the session secret once, keep it private, and reuse it across restarts.

```bash
HOST=127.0.0.1 \
PORT=6683 \
OCEAN_BRAIN_PASSWORD='choose-a-strong-password' \
OCEAN_BRAIN_SESSION_SECRET='paste-a-long-random-secret-here' \
npx ocean-brain serve
```

For example, `openssl rand -hex 32` generates a suitable random session secret.

### Docker

The Docker example uses password mode, persists the database and images on the host, and publishes the app on loopback only.

```bash
docker run -d \
  --name ocean-brain \
  --restart unless-stopped \
  -e OCEAN_BRAIN_PASSWORD='choose-a-strong-password' \
  -e OCEAN_BRAIN_SESSION_SECRET='paste-a-long-random-secret-here' \
  -v "$PWD/data:/data" \
  -v "$PWD/assets:/assets" \
  -p 127.0.0.1:6683:6683 \
  baealex/ocean-brain:latest
```

`latest` is convenient for evaluation. For an instance you intend to keep, use an exact tag from [GitHub Releases](https://github.com/baealex/ocean-brain/releases), written as `baealex/ocean-brain:<version>`.

Before exposing Ocean Brain beyond the host machine:

- Keep password mode enabled.
- Put the instance behind HTTPS.
- Change the loopback bind only when your network or reverse proxy requires it.
- Back up the database and images before upgrading.

In password mode, uploaded image URLs are protected by the same authenticated session as the workspace.

### Runtime settings

| Setting | Purpose |
|---|---|
| `OCEAN_BRAIN_PASSWORD` | Shared password for the workspace |
| `OCEAN_BRAIN_SESSION_SECRET` | Long, random secret used to protect login sessions |
| `OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH=true` | Explicitly enable open mode; do not combine with a password |
| `OCEAN_BRAIN_DATA_DIR` | Override the default npx data directory and its `db.sqlite3` path |
| `OCEAN_BRAIN_IMAGE_DIR` | Override the uploaded image directory |
| `DATABASE_URL` | Override the SQLite file URL; this takes precedence over `OCEAN_BRAIN_DATA_DIR` for the database path |
| `HOST`, `PORT`, `--host`, `--port` | Change the bind address and port; environment values take precedence and defaults are `0.0.0.0` and `6683` |

## Data and recovery

Ocean Brain stores note data in SQLite and uploaded images separately on disk. Back up both locations together.

| Run method | SQLite database | Uploaded images |
|---|---|---|
| `npx` | `~/.ocean-brain/data/db.sqlite3` | `~/.ocean-brain/assets/images` |
| Docker example above | `./data/db.sqlite3` | `./assets/images` |

For a simple, consistent backup, stop Ocean Brain and copy both the database and image directory. Restore them while the instance is stopped, then start it again.

Ocean Brain also has recovery paths for everyday mistakes:

- Deleted notes remain in Trash for 30 days.
- Note snapshots are retained for up to 7 days, with at most 10 snapshots per note.

Trash, snapshots, and individual note exports are useful recovery tools, but they are not full-instance backups.

## Connect an MCP client

Ocean Brain can expose the workspace to [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) clients. The MCP tools can search and read notes, query tags and properties, create notes, make targeted Markdown or metadata edits, and move notes to Trash.

1. Open `Settings > MCP` and turn MCP access on.
2. Select **Issue token**. If a token already exists, the button reads **Rotate token**.
3. Copy the token while it is visible and save it in a local file.
4. Choose Codex, Claude, or JSON in the setup panel and copy the generated configuration.

An equivalent `.mcp.json` entry looks like this:

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
        "/absolute/path/to/ocean-brain-mcp-token.txt"
      ]
    }
  }
}
```

Set `--server` to the Ocean Brain URL reachable from the machine running the MCP client; replace `localhost` when the instance is remote or behind a proxy.

Ocean Brain keeps one active MCP token. Rotating or revoking it immediately invalidates the previous token. `--token-file` is preferred over placing the token directly in client configuration.

For a long-lived setup, pin the MCP CLI to a version compatible with the server by replacing `ocean-brain` in the command with `ocean-brain@<version>`.

## Development

The repository uses Node.js `22`, pnpm `10.25.0`, and a `packages/*` workspace.

```bash
pnpm install

OCEAN_BRAIN_PASSWORD='development-password' \
OCEAN_BRAIN_SESSION_SECRET='development-session-secret' \
pnpm dev
```

The client normally runs at <http://localhost:5173> and the server at <http://localhost:6683>. Use the npm package or Docker image when you want a packaged instance; the source commands above are for development.

Before opening a pull request, run the checks for the changed scope:

```bash
pnpm check:encoding
pnpm lint
pnpm test:ci
pnpm type-check
pnpm build
```

The repository-specific workflow is documented in [DEV_CONVENTION.md](./docs/process/DEV_CONVENTION.md) and [GIT_CONVENTION.md](./docs/process/GIT_CONVENTION.md).

## License

Ocean Brain is available under the [MIT License](./LICENSE).
