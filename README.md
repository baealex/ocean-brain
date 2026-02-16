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

<img width="3210" height="2030" alt="image" src="https://github.com/user-attachments/assets/051abb07-9eb9-4eff-ac2c-6676cae086bd" />

<img width="3210" height="2030" alt="image" src="https://github.com/user-attachments/assets/8c308c3e-90fa-4a9d-a992-b5720636f8fd" />

<img width="3210" height="2030" alt="image" src="https://github.com/user-attachments/assets/73665dbe-5811-4905-99da-205435f936d3" />

<img width="3210" height="2030" alt="image" src="https://github.com/user-attachments/assets/aae508e2-d160-46ec-b7c8-d5327eb571b6" />

<br>

## Try it now

**[Live Demo](https://demo-ocean-brain.baejino.com/)** - See Ocean Brain in action

<br>

## Quick Start

### npx (Easiest)

```bash
npx ocean-brain
```

That's it! Open `http://localhost:6683` and start writing.

### Docker

```bash
docker run -d \
    -v ./assets:/assets \
    -v ./data:/data \
    -p 6683:6683 \
    baealex/ocean-brain
```

### From Source

```bash
pnpm install
pnpm build
pnpm start
```

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
