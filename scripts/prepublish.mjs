#!/usr/bin/env node

import { execSync } from 'child_process';
import { cpSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const cliDir = path.join(rootDir, 'packages', 'cli');

function runPnpm(args) {
    const cmd = ['pnpm', ...args].join(' ');
    execSync(cmd, {
        cwd: rootDir,
        stdio: 'inherit',
        env: process.env
    });
}

function copyArtifacts() {
    const cliServerDir = path.join(cliDir, 'server');
    rmSync(cliServerDir, { recursive: true, force: true });

    // server dist
    mkdirSync(path.join(cliServerDir, 'dist'), { recursive: true });
    cpSync(
        path.join(rootDir, 'packages', 'server', 'dist'),
        path.join(cliServerDir, 'dist'),
        { recursive: true }
    );

    // prisma schema + migrations
    mkdirSync(path.join(cliServerDir, 'prisma'), { recursive: true });
    cpSync(
        path.join(rootDir, 'packages', 'server', 'prisma', 'schema.prisma'),
        path.join(cliServerDir, 'prisma', 'schema.prisma')
    );
    cpSync(
        path.join(rootDir, 'packages', 'server', 'prisma', 'migrations'),
        path.join(cliServerDir, 'prisma', 'migrations'),
        { recursive: true }
    );

    // client dist
    mkdirSync(path.join(cliServerDir, 'client', 'dist'), { recursive: true });
    cpSync(
        path.join(rootDir, 'packages', 'client', 'dist'),
        path.join(cliServerDir, 'client', 'dist'),
        { recursive: true }
    );
}

console.log('=== Build client ===');
runPnpm(['--filter', '@ocean-brain/client', 'build']);

console.log('=== Build server ===');
runPnpm(['--filter', '@ocean-brain/server', 'build']);

console.log('=== Build CLI ===');
runPnpm(['--filter', 'ocean-brain', 'build']);

console.log('=== Copy artifacts to CLI package ===');
copyArtifacts();

console.log('=== Done ===');
console.log('CLI package is ready to publish.');
console.log('  cd packages/cli && pnpm publish --access public');
