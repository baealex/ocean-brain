#!/usr/bin/env node

import { spawnSync } from 'child_process';
import { appendFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const cliDir = path.join(rootDir, 'packages', 'cli');
const tempDir = path.join(rootDir, '.tmp');

mkdirSync(tempDir, { recursive: true });

const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const result = spawnSync(
    pnpmBin,
    ['--dir', cliDir, 'pack', '--pack-destination', tempDir],
    {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
        env: process.env
    }
);

if (result.error) {
    throw result.error;
}

if (result.status !== 0) {
    throw new Error(`pnpm pack failed with exit code ${result.status}`);
}

const output = result.stdout;

const lines = output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

const tarball = lines.findLast(line => line.endsWith('.tgz'));
if (!tarball) {
    throw new Error('Failed to resolve packed tarball path.');
}

const tarballPath = path.isAbsolute(tarball) ? tarball : path.join(tempDir, tarball);
const relativePath = path.relative(rootDir, tarballPath).split(path.sep).join(path.posix.sep);
console.log(`Tarball: ${relativePath}`);

if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `path=${relativePath}\n`);
}
