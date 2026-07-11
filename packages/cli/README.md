<!--
npm package README for the public ocean-brain CLI.

Keep the product overview in the repository README. This file owns the public
`serve` and `mcp` command interface, including npx auth and storage behavior.
-->

# ocean-brain CLI

The npm distribution for [Ocean Brain](https://github.com/baealex/ocean-brain). It provides two commands:

- `ocean-brain serve` runs the packaged Ocean Brain web app and server.
- `ocean-brain mcp` connects an MCP client to a running Ocean Brain instance over stdio.

For the product overview and screenshots, see the [Ocean Brain project](https://github.com/baealex/ocean-brain#readme).

## Requirements

Use Node.js 22. A global installation is not required; the examples below use `npx`.

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

Deleted notes remain in Trash for 30 days. Note snapshots are retained for up to 7 days, with at most 10 snapshots per note. These recovery tools and individual exports do not replace a full backup.

For a long-lived installation, replace `ocean-brain` in the commands with an exact version such as `ocean-brain@X.Y.Z`.

## `mcp`

The `mcp` command starts a stdio MCP server that forwards tool calls to an existing Ocean Brain instance. It does not start the web app.

The MCP tools can search and read notes, query tags and properties, create notes, make targeted Markdown or metadata edits, and move notes to Trash.

First enable MCP access under `Settings > MCP`, issue a token, and save it to a local file. Then configure the MCP client, for example:

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

Set `--server` to the Ocean Brain URL reachable from the machine running the MCP client. Replace `localhost` when the instance is remote or behind a proxy.

### Options

| Option | Behavior |
|---|---|
| `-s, --server <url>` | Ocean Brain server URL; defaults to `http://localhost:6683` |
| `--token-file <path>` | Read the bearer token from a file; takes precedence over `--token` |
| `--token <token>` | Direct bearer-token fallback |

Prefer `--token-file` so the token is not stored directly in client configuration. Ocean Brain keeps one active MCP token; rotating or revoking it immediately invalidates the previous token. For a long-lived MCP setup, pin an npm package version compatible with the requirement shown in `Settings > MCP`.

## Links

- [Product documentation](https://github.com/baealex/ocean-brain#readme)
- [Releases](https://github.com/baealex/ocean-brain/releases)
- [Source code](https://github.com/baealex/ocean-brain)
- [Issues](https://github.com/baealex/ocean-brain/issues)
- [MIT License](https://github.com/baealex/ocean-brain/blob/main/LICENSE)
