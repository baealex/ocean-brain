FROM node:22-alpine

ARG VERSION=latest
RUN npm i -g ocean-brain@${VERSION}

RUN mkdir -p /data /assets/images
ENV OCEAN_BRAIN_DATA_DIR=/data
ENV OCEAN_BRAIN_IMAGE_DIR=/assets/images
ENV DATABASE_URL="file:/data/db.sqlite3"

EXPOSE 6683
CMD ["ocean-brain", "serve"]
