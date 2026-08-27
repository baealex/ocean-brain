#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..', '..');
const serverDir = path.join(rootDir, 'packages', 'server');
const workerSetup = path.join(serverDir, 'test', 'setup.ts');
const runDirectory = mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-server-test-'));
const templateDatabase = path.join(runDirectory, 'template.sqlite3');
const fallbackDataDirectory = path.join(runDirectory, 'runner-data');
const fallbackImageDirectory = path.join(fallbackDataDirectory, 'assets', 'images');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

mkdirSync(fallbackImageDirectory, { recursive: true });

const testEnvironment = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: `file:${templateDatabase}`,
    OCEAN_BRAIN_DATA_DIR: fallbackDataDirectory,
    OCEAN_BRAIN_IMAGE_DIR: fallbackImageDirectory,
    OCEAN_BRAIN_SEARCH_INDEX_PATH: path.join(fallbackDataDirectory, 'search.sqlite3'),
    OCEAN_BRAIN_HTTP_LOG: 'false',
    OCEAN_BRAIN_TEST_RUN_ROOT: runDirectory,
    OCEAN_BRAIN_TEST_DB_TEMPLATE: templateDatabase,
};

let activeChild = null;
let cleanedUp = false;

const cleanup = () => {
    if (cleanedUp) {
        return;
    }

    cleanedUp = true;
    rmSync(runDirectory, { recursive: true, force: true });
};

const run = (args) => {
    return new Promise((resolve, reject) => {
        const child = spawn(pnpmCommand, args, {
            cwd: rootDir,
            env: testEnvironment,
            stdio: 'inherit',
        });
        activeChild = child;

        child.once('error', reject);
        child.once('exit', (code, signal) => {
            activeChild = null;
            resolve({ code: code ?? 1, signal });
        });
    });
};

const forwardSignal = (signal) => {
    if (activeChild && activeChild.exitCode === null && !activeChild.killed) {
        activeChild.kill(signal);
        return;
    }

    cleanup();
    process.exitCode = 1;
};

process.on('exit', cleanup);
process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

let exitCode = 1;

try {
    const migration = await run([
        '--dir',
        serverDir,
        'exec',
        'prisma',
        'migrate',
        'deploy',
        '--schema=prisma/schema.prisma',
    ]);

    if (migration.code !== 0 || migration.signal) {
        exitCode = migration.code;
    } else {
        const tests = await run([
            '--dir',
            serverDir,
            'exec',
            'tsx',
            '--tsconfig',
            'tsconfig.json',
            '--test',
            '--import',
            workerSetup,
            'src/**/*.test.ts',
            'test/**/*.test.ts',
        ]);
        exitCode = tests.code;
    }
} catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server test runner error';
    process.stderr.write(`Server test runner failed: ${message}\n`);
} finally {
    cleanup();
}

process.exitCode = exitCode;
