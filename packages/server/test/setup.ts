import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { after, beforeEach } from 'node:test';

const requireEnvironmentPath = (name: string) => {
    const value = process.env[name];

    assert.ok(value, `${name} must be set by the server test runner.`);
    return path.resolve(value);
};

const assertPathInside = (parent: string, target: string) => {
    const relative = path.relative(parent, target);

    assert.ok(
        relative && !relative.startsWith('..') && !path.isAbsolute(relative),
        `${target} must be inside ${parent}`,
    );
};

const runRoot = requireEnvironmentPath('OCEAN_BRAIN_TEST_RUN_ROOT');
const templateDatabase = requireEnvironmentPath('OCEAN_BRAIN_TEST_DB_TEMPLATE');

assertPathInside(runRoot, templateDatabase);
assert.ok(existsSync(templateDatabase), `Migrated test database template is missing: ${templateDatabase}`);

const workerRoot = mkdtempSync(path.join(runRoot, 'worker-'));
const databasePath = path.join(workerRoot, 'db.sqlite3');
const dataDirectory = path.join(workerRoot, 'data');
const imageDirectory = path.join(dataDirectory, 'assets', 'images');
const searchIndexPath = path.join(dataDirectory, 'search.sqlite3');

assertPathInside(runRoot, workerRoot);

process.env.DATABASE_URL = `file:${databasePath}`;
process.env.OCEAN_BRAIN_DATA_DIR = dataDirectory;
process.env.OCEAN_BRAIN_IMAGE_DIR = imageDirectory;
process.env.OCEAN_BRAIN_SEARCH_INDEX_PATH = searchIndexPath;
process.env.OCEAN_BRAIN_TEST_WORKER_ROOT = workerRoot;

const resetFiles = () => {
    rmSync(workerRoot, { recursive: true, force: true });
    mkdirSync(workerRoot, { recursive: true });
    copyFileSync(templateDatabase, databasePath);
    mkdirSync(imageDirectory, { recursive: true });
};

resetFiles();

const [{ default: models }, { closeDefaultSemanticSearchManager }] = await Promise.all([
    import('../src/models.js'),
    import('../src/features/search/search-manager.js'),
]);

beforeEach(async () => {
    await closeDefaultSemanticSearchManager();
    await models.$disconnect();
    resetFiles();
});

after(async () => {
    await closeDefaultSemanticSearchManager();
    await models.$disconnect();
});
