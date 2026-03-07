#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

function run(command) {
    return execSync(command, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit']
    }).trim();
}

const commitSubject = run('git log -1 --pretty=%s');
console.log(`Head commit subject: ${commitSubject}`);

const match = commitSubject.match(
    /^.*Bump version to (\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)(?: \(#\d+\))?$/
);

if (!match) {
    console.log('Not a release bump commit. Skip tagging.');
    process.exit(0);
}

const commitVersion = match[1];
const cliPackage = JSON.parse(readFileSync('packages/cli/package.json', 'utf8'));
const packageVersion = cliPackage.version;

if (packageVersion !== commitVersion) {
    console.error(`Version mismatch: commit=${commitVersion}, package=${packageVersion}`);
    process.exit(1);
}

const tag = `v${packageVersion}`;

try {
    run(`git ls-remote --exit-code --tags origin refs/tags/${tag}`);
    console.log(`Tag ${tag} already exists on origin. Skip.`);
    process.exit(0);
} catch {
    // Continue when tag is not found.
}

run(`git tag ${tag}`);
run(`git push origin ${tag}`);
console.log(`Created and pushed tag: ${tag}`);
