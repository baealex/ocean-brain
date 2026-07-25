FROM node:22-trixie-slim@sha256:e6d9a389d34ff9678438af985c9913fbd1eb6ed36e80fea56644f4b4f6dd70ba AS install

ARG VERSION=latest
RUN npm i -g --omit=dev --no-audit --no-fund ocean-brain@${VERSION} \
    && APP_ROOT="$(npm root -g)/ocean-brain" \
    && find "$APP_ROOT" -type f \( \
        -name '*.map' -o \
        -name '*.d.ts' -o \
        -name '*.d.mts' -o \
        -name '*.d.cts' \
    \) -delete \
    && mkdir -p /runtime/data /runtime/assets/images

# Keep the current root-user behavior so existing host bind mounts remain writable.
# The distroless runtime still removes the shell and package manager.
FROM gcr.io/distroless/nodejs22-debian13:latest@sha256:4693a48bdba4a676bf3f0c0a66c106c242ba3167fbc97d5008171c37d96dee12

COPY --from=install /usr/local/lib/node_modules/ocean-brain /usr/local/lib/node_modules/ocean-brain
COPY --from=install /runtime/data /data
COPY --from=install /runtime/assets /assets

ENV OCEAN_BRAIN_DATA_DIR=/data
ENV OCEAN_BRAIN_IMAGE_DIR=/assets/images
ENV DATABASE_URL="file:/data/db.sqlite3"

EXPOSE 6683
CMD ["/usr/local/lib/node_modules/ocean-brain/dist/index.js", "serve"]
