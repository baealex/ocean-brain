#!/usr/bin/env node

import { execSync } from 'child_process';
import { appendFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const cliDir = path.join(rootDir, 'packages', 'cli');
const tempDir = path.join(rootDir, '.tmp');

mkdirSync(tempDir, { recursive: true });

const output = execSync(
    `npm pack --pack-destination "${tempDir}"`,
    {
        cwd: cliDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
        env: process.env
    }
);

const lines = output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

const tarball = lines[lines.length - 1];
if (!tarball) {
    throw new Error('Failed to resolve packed tarball filename.');
}

const relativePath = path.posix.join('.tmp', tarball);
console.log(`Tarball: ${relativePath}`);

if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `path=${relativePath}\n`);
}
