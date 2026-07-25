<!--
Docker Hub Overview source.

Suggested Docker Hub short description:
Self-hosted writing space for connected notes.

Keep the product overview in README.md. This file owns Docker image usage:
authentication, tags, container startup, networking, mounts, and backups.
-->

<img src="https://raw.githubusercontent.com/baealex/ocean-brain/main/packages/client/public/icon.png" alt="Ocean Brain logo: a brain resting on ocean waves" width="112" />

# Ocean Brain

**A self-hosted writing space for connected notes, packaged for Docker.**

One container runs the complete Ocean Brain web app and server.

![Ocean Brain workspace showing a connected note with typed properties, inline references, and automatic backlinks](https://raw.githubusercontent.com/baealex/ocean-brain/main/docs/assets/ocean-brain-workspace.png)

[Product overview](https://github.com/baealex/ocean-brain#readme) · [Releases](https://github.com/baealex/ocean-brain/releases) · [Source](https://github.com/baealex/ocean-brain)

## Start a password-protected workspace

Generate a session secret once, keep it private, and reuse it when recreating the container:

```bash
openssl rand -hex 32
```

```bash
docker run -d \
  --name ocean-brain \
  --restart unless-stopped \
  -e OCEAN_BRAIN_PASSWORD='choose-a-strong-password' \
  -e OCEAN_BRAIN_SESSION_SECRET='paste-the-generated-session-secret-here' \
  -v "$PWD/data:/data" \
  -v "$PWD/assets:/assets" \
  -p 127.0.0.1:6683:6683 \
  baealex/ocean-brain:latest
```

Open <http://localhost:6683>.

`latest` is convenient for evaluation. For a workspace you intend to keep, choose an exact version from [GitHub Releases](https://github.com/baealex/ocean-brain/releases) and use `baealex/ocean-brain:<version>`. Docker tags omit the release tag's leading `v`.

The example publishes Ocean Brain on loopback only. Before exposing it beyond the host machine, keep password mode enabled, place the instance behind HTTPS, and change the bind address only when your network or reverse proxy requires it. The container refuses to start unless password mode or open mode is selected explicitly.

## Local-only open mode

Open mode has no login. Use it only on your own machine, keep the loopback port binding, and do not combine it with the password variables.

```bash
docker run --rm \
  -e OCEAN_BRAIN_ALLOW_INSECURE_NO_AUTH=true \
  -v "$PWD/data:/data" \
  -v "$PWD/assets:/assets" \
  -p 127.0.0.1:6683:6683 \
  baealex/ocean-brain:latest
```

## Persistent paths

| Content | Container path | Host path above |
|---|---|---|
| SQLite database | `/data/db.sqlite3` | `./data/db.sqlite3` |
| Uploaded images | `/assets/images` | `./assets/images` |

Stop the container and back up `./data` and `./assets` together before changing versions. Restore both while the container remains stopped. Trash, note snapshots, and individual exports are useful recovery tools, but they do not replace a full backup.

The image is published for `linux/amd64` and `linux/arm64`.
