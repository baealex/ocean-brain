FROM node:22-alpine

ARG VERSION=latest
RUN npm i -g --omit=dev --no-audit --no-fund ocean-brain@${VERSION} \
    && npm cache clean --force \
    && rm -rf /root/.npm /root/.cache /tmp/*

RUN mkdir -p /data /assets/images
ENV OCEAN_BRAIN_DATA_DIR=/data
ENV OCEAN_BRAIN_IMAGE_DIR=/assets/images
ENV DATABASE_URL="file:/data/db.sqlite3"

EXPOSE 6683
CMD ["ocean-brain", "serve"]
