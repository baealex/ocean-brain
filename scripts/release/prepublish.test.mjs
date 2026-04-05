import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const cliPackageJsonPath = path.join(rootDir, 'packages', 'cli', 'package.json');
const cliPostinstallScriptPath = path.join(
    rootDir,
    'packages',
    'cli',
    'scripts',
    'postinstall-prisma.mjs'
);

test('CLI package uses a portable Prisma postinstall script', () => {
    const cliPackageJson = JSON.parse(readFileSync(cliPackageJsonPath, 'utf8'));

    assert.equal(cliPackageJson.scripts?.postinstall, 'node ./scripts/postinstall-prisma.mjs');
    assert.equal(cliPackageJson.files.includes('scripts/postinstall-prisma.mjs'), true);
});

test('Prisma postinstall script resolves packaged and workspace schema locations', async () => {
    const { resolveSchemaPath } = await import(pathToFileURL(cliPostinstallScriptPath).href);

    assert.equal(
        resolveSchemaPath('/tmp/ocean-brain', (candidate) => candidate === '/tmp/ocean-brain/server/prisma/schema.prisma'),
        '/tmp/ocean-brain/server/prisma/schema.prisma'
    );
    assert.equal(
        resolveSchemaPath('/tmp/repo/packages/cli', (candidate) => candidate === '/tmp/repo/packages/server/prisma/schema.prisma'),
        '/tmp/repo/packages/server/prisma/schema.prisma'
    );
});
