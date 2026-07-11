FROM node:22-alpine AS install

ARG VERSION=latest
RUN npm i -g --omit=dev --no-audit --no-fund ocean-brain@${VERSION} \
    && APP_ROOT="$(npm root -g)/ocean-brain" \
    && find "$APP_ROOT" -type f \( \
        -name '*.map' -o \
        -name '*.d.ts' -o \
        -name '*.d.mts' -o \
        -name '*.d.cts' \
    \) -delete

FROM alpine:3.24

RUN apk add --no-cache libgcc libstdc++ openssl

COPY --from=install /usr/local/bin/node /usr/local/bin/node
COPY --from=install /usr/local/lib/node_modules/ocean-brain /usr/local/lib/node_modules/ocean-brain

RUN ln -s ../lib/node_modules/ocean-brain/dist/index.js /usr/local/bin/ocean-brain \
    && mkdir -p /data /assets/images

ENV OCEAN_BRAIN_DATA_DIR=/data
ENV OCEAN_BRAIN_IMAGE_DIR=/assets/images
ENV DATABASE_URL="file:/data/db.sqlite3"

EXPOSE 6683
CMD ["ocean-brain", "serve"]
