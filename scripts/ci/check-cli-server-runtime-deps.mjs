#!/usr/bin/env node

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

const readPackageJson = (relativePath) => JSON.parse(
    readFileSync(path.join(rootDir, relativePath), 'utf8')
);

const serverPackage = readPackageJson('packages/server/package.json');
const cliPackage = readPackageJson('packages/cli/package.json');

const serverDependencies = serverPackage.dependencies ?? {};
const cliDependencies = cliPackage.dependencies ?? {};

const missing = [];
const mismatched = [];
const nonCatalogShared = [];

for (const [name, serverSpec] of Object.entries(serverDependencies)) {
    const cliSpec = cliDependencies[name];

    if (!cliSpec) {
        missing.push({ name, serverSpec });
        continue;
    }

    if (cliSpec !== serverSpec) {
        mismatched.push({ name, serverSpec, cliSpec });
        continue;
    }

    if (serverSpec !== 'catalog:') {
        nonCatalogShared.push({ name, spec: serverSpec });
    }
}

if (!missing.length && !mismatched.length && !nonCatalogShared.length) {
    console.log('CLI/server runtime dependency parity check passed.');
    process.exit(0);
}

console.error('CLI/server runtime dependency parity check failed.');

if (missing.length) {
    console.error('\nMissing server runtime dependency in CLI package:');
    for (const item of missing) {
        console.error(`- ${item.name} (${item.serverSpec})`);
    }
}

if (mismatched.length) {
    console.error('\nMismatched dependency spec:');
    for (const item of mismatched) {
        console.error(`- ${item.name}`);
        console.error(`  server: ${item.serverSpec}`);
        console.error(`  cli:    ${item.cliSpec}`);
    }
}

if (nonCatalogShared.length) {
    console.error('\nShared runtime dependency must use pnpm catalog:');
    for (const item of nonCatalogShared) {
        console.error(`- ${item.name} (${item.spec})`);
    }
}

process.exit(1);
