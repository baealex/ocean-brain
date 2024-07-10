#!/bin/bash

cd server/src
npx pnpm i

cd client
npx pnpm i

cd ..
npm run build:client && npm run start
