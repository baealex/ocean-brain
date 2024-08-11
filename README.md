# ocean-brain

Ocean Brain is a note-taking app designed to help you capture and organize your thoughts seamlessly. Just like the vast ocean holds countless treasures, Ocean Brain allows you to record your daily experiences, insights, and learnings, ensuring nothing gets lost. Host it on your own server to maintain complete control over your data while enjoying a fluid and intuitive user experience. Dive into Ocean Brain and let your thoughts flow freely and securely.

![](https://github.com/baealex/ocean-brain/assets/35596687/a32b1315-bf47-42e7-9446-cbc76ebf39a3)

![](https://github.com/baealex/ocean-brain/assets/35596687/355fd32f-520f-496c-af9a-a6c1f5da9c6a)


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
