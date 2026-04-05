import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const cliPackageJsonPath = path.join(rootDir, 'packages', 'cli', 'package.json');

test('CLI package generates Prisma client from the published server schema on install', () => {
    const cliPackageJson = JSON.parse(readFileSync(cliPackageJsonPath, 'utf8'));

    assert.equal(
        cliPackageJson.scripts?.postinstall,
        'prisma generate --schema ./server/prisma/schema.prisma'
    );
});
