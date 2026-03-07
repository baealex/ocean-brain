#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const [, , version] = process.argv;

if (!version) {
    console.error('Usage: node scripts/release/bump-version.mjs <version>');
    console.error('Example: node scripts/release/bump-version.mjs 1.2.0');
    process.exit(1);
}

const semverLike = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;
if (!semverLike.test(version)) {
    console.error(`Invalid version: "${version}"`);
    console.error('Expected semver format like 1.2.3, 1.2.3-beta.1, or 1.2.3+build.5');
    process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const cliPackagePath = path.join(rootDir, 'packages', 'cli', 'package.json');

const pkg = JSON.parse(readFileSync(cliPackagePath, 'utf8'));
pkg.version = version;
writeFileSync(cliPackagePath, `${JSON.stringify(pkg, null, 4)}\n`);

console.log(`Updated packages/cli/package.json -> ${version}`);
console.log('');
console.log('Next steps:');
console.log('  git add packages/cli/package.json');
console.log(`  git commit -m "<release-emoji> Bump version to ${version}"`);
console.log('  git push origin <release-branch>');
