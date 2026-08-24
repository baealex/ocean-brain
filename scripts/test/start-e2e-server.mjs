#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..', '..');
const port = process.env.E2E_PORT ?? '0';
const clientDist = path.resolve(process.env.E2E_CLIENT_DIST ?? path.join(rootDir, 'packages/client/dist'));

if (!existsSync(path.join(clientDist, 'index.html'))) {
    process.stderr.write(`E2E client build is missing: ${clientDist}\n`);
    process.exit(1);
}

const runDirectory = mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-e2e-'));
const dataDirectory = path.join(runDirectory, 'data');
const imageDirectory = path.join(dataDirectory, 'assets', 'images');

mkdirSync(imageDirectory, { recursive: true });

let cleanedUp = false;
const cleanup = () => {
    if (cleanedUp) {
        return;
    }

    cleanedUp = true;
    rmSync(runDirectory, { recursive: true, force: true });
};

process.on('exit', cleanup);

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const server = spawn(pnpmCommand, ['--filter', '@ocean-brain/server', 'start'], {
    cwd: rootDir,
    env: {
        ...process.env,
        DATABASE_URL: `file:${path.join(dataDirectory, 'db.sqlite3')}`,
        OCEAN_BRAIN_CLIENT_DIST: clientDist,
        OCEAN_BRAIN_DATA_DIR: dataDirectory,
        OCEAN_BRAIN_IMAGE_DIR: imageDirectory,
        OCEAN_BRAIN_PASSWORD: 'e2e-password',
        OCEAN_BRAIN_SESSION_SECRET: 'e2e-session-secret-for-browser-tests',
        HOST: '127.0.0.1',
        PORT: port,
    },
    stdio: 'inherit',
});

const forwardSignal = (signal) => {
    if (server.exitCode === null && !server.killed) {
        server.kill(signal);
        return;
    }

    cleanup();
    process.exit(1);
};

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

server.on('error', (error) => {
    process.stderr.write(`E2E server failed to start: ${error.message}\n`);
    cleanup();
    process.exit(1);
});

server.on('exit', (code, signal) => {
    cleanup();
    process.exit(signal ? 1 : (code ?? 1));
});
