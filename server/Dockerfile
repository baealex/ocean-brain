# Image for client build

FROM node:22-alpine as client

WORKDIR /app

COPY ./src/client/package.json ./
COPY ./src/client/pnpm-lock.yaml ./

RUN npx pnpm i

COPY ./src/client/ ./

RUN npm run build

# Image for server build

FROM node:22-alpine as server

WORKDIR /app

COPY ./src/package.json ./
COPY ./src/pnpm-lock.yaml ./

RUN npx pnpm i

COPY ./src/ ./

RUN rm -rf client
RUN npm run build

# Image for end user

FROM node:22-alpine

WORKDIR /app

COPY --from=server /app/.env ./
COPY --from=server /app/package.json ./
COPY --from=server /app/pnpm-lock.yaml ./
COPY --from=server /app/prisma ./prisma
COPY --from=server /app/public ./public
COPY --from=server /app/dist ./dist
COPY --from=client /app/dist ./client/dist

RUN npx pnpm i --production

RUN ln -s /app/prisma/data /data
RUN ln -s /app/public/assets /assets

ENTRYPOINT ["npm", "run"]
CMD ["start"]
