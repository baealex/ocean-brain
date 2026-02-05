# Ocean Brain

**Self-hosted, open-source Notion alternative** with bi-directional links and privacy-first design.

Own your notes. Connect your thoughts. No cloud required, no subscription needed.

> Just like the vast ocean holds countless treasures, Ocean Brain lets your thoughts flow freely and securely on your own server.

### Why Ocean Brain?

- **Privacy-first**: Your notes stay on your server. No third-party access, ever.
- **Notion-like editor**: Block-based editing powered by [BlockNote](https://www.blocknotejs.org/)
- **Bi-directional links**: Connect notes with `[` and see backlinks instantly
- **Zero subscription**: Self-host once, use forever
- **Quick setup**: One Docker command, ready in 30 seconds

![](https://github.com/user-attachments/assets/d3a88905-2e53-4dd0-a799-332900cb30e0)
![](https://github.com/user-attachments/assets/ba9f5caf-c847-4e79-89ef-e7084dbe1e50)
![](https://github.com/user-attachments/assets/bde28e6b-77d6-4e8b-96ac-92a799a27afc)


<br>

## Try it now

**[Live Demo](https://demo-ocean-brain.baejino.com/)** - See Ocean Brain in action

<br>

## Quick Start

### Docker (Recommended)

```bash
docker run -d \
    -v ./assets:/assets \
    -v ./data:/data \
    -p 3000:3000 \
    baealex/ocean-brain
```

That's it! Open `http://localhost:3000` and start writing.

### From Source

```bash
npm i
npm run build
npm run start
```

<br>

## Features

| Feature | Description |
|---------|-------------|
| Block editor | Notion-like editing with `/` commands |
| Bi-directional links | Link notes with `[` and track backlinks |
| Tags | Organize with `@` mentions |
| Search | Full-text search across all notes |
| Pin notes | Keep important notes at the top |
| Reminders | Set reminders with priorities |
| Calendar view | See your notes by date |
