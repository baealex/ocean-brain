FROM node:24.22.1-trixie-slim@sha256:43b9ba1142b8dcf33fa8f922ca1be85714adc444e0586c7cf7726daaeabc1bea AS install

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
FROM gcr.io/distroless/nodejs24-debian13:latest@sha256:c23cc7262662efd642cd9c9d61783d10f600321f7bafdd37c8a82365ffaa2aa6

COPY --from=install /usr/local/lib/node_modules/ocean-brain /usr/local/lib/node_modules/ocean-brain
COPY --from=install /runtime/data /data
COPY --from=install /runtime/assets /assets

ENV OCEAN_BRAIN_DATA_DIR=/data
ENV OCEAN_BRAIN_IMAGE_DIR=/assets/images
ENV DATABASE_URL="file:/data/db.sqlite3"

EXPOSE 6683
CMD ["/usr/local/lib/node_modules/ocean-brain/dist/index.js", "serve"]
