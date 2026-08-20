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
const bundleExternals = serverPackage.oceanBrain?.bundleExternals ?? [];

const missing = [];
const mismatched = [];
const unexpectedRuntimeDependencies = [];
const unknownExternals = [];

for (const name of bundleExternals) {
    const serverSpec = serverDependencies[name];
    if (!serverSpec) {
        unknownExternals.push(name);
        continue;
    }

    const cliSpec = cliDependencies[name];
    if (!cliSpec) {
        missing.push({ name, serverSpec });
        continue;
    }

    if (cliSpec !== serverSpec) {
        mismatched.push({ name, serverSpec, cliSpec });
    }
}

for (const [name, cliSpec] of Object.entries(cliDependencies)) {
    if (!bundleExternals.includes(name)) {
        unexpectedRuntimeDependencies.push({ name, cliSpec });
    }
}

if (!missing.length && !mismatched.length && !unexpectedRuntimeDependencies.length && !unknownExternals.length) {
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

if (unexpectedRuntimeDependencies.length) {
    console.error('\nBundled dependency must not be installed by the published CLI:');
    for (const item of unexpectedRuntimeDependencies) {
        console.error(`- ${item.name} (${item.cliSpec})`);
    }
}

if (unknownExternals.length) {
    console.error('\nBundle external is not declared by the server package:');
    for (const dependency of unknownExternals) {
        console.error(`- ${dependency}`);
    }
}

process.exit(1);
