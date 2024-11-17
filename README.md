# ocean-brain

Ocean Brain is a note-taking app designed to help you capture and organize your thoughts seamlessly. Just like the vast ocean holds countless treasures, Ocean Brain allows you to record your daily experiences, insights, and learnings, ensuring nothing gets lost. Host it on your own server to maintain complete control over your data while enjoying a fluid and intuitive user experience. Dive into Ocean Brain and let your thoughts flow freely and securely.

![](https://github.com/user-attachments/assets/d3a88905-2e53-4dd0-a799-332900cb30e0)
![](https://github.com/user-attachments/assets/ba9f5caf-c847-4e79-89ef-e7084dbe1e50)
![](https://github.com/user-attachments/assets/bde28e6b-77d6-4e8b-96ac-92a799a27afc)


<br>

## Features

- [x] Notion like note taking (Powered by [BlockNote](https://www.blocknotejs.org/))
- [x] Note taking helper (use `/`)
- [x] Note tagging (use `@`)
- [x] Note linking (use `[`, reference / back-reference)
- [x] Note pinning
- [x] Note searching

<br>

## Demo site

[demo-ocean-brain.baejino.com](https://demo-ocean-brain.baejino.com/)

<br>

## Setup

### use Docker

```
docker run \
    -v ./assets:/assets \
    -v ./data:/data \
    -p 3000:3000 \
    baealex/ocean-brain
```

you can connect to `http://localhost:3000`

### use Node

```
./start.sh
```

you can connect to `http://localhost:3000`
