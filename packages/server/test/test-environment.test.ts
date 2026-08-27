import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import models from '../src/models.js';
import { paths } from '../src/paths.js';

const TEST_CACHE_KEY = 'server-test-isolation-sentinel';

const requireTestWorkerRoot = () => {
    const workerRoot = process.env.OCEAN_BRAIN_TEST_WORKER_ROOT;

    assert.ok(workerRoot, 'Server tests must run through the isolated test environment.');
    return path.resolve(workerRoot);
};

const assertPathInside = (parent: string, target: string) => {
    const relative = path.relative(parent, path.resolve(target));

    assert.ok(
        relative && !relative.startsWith('..') && !path.isAbsolute(relative),
        `${target} must be inside ${parent}`,
    );
};

test('server tests keep every persistent path inside the isolated worker directory', () => {
    const workerRoot = requireTestWorkerRoot();
    const databaseUrl = process.env.DATABASE_URL;

    assert.ok(databaseUrl?.startsWith('file:'), 'Server tests require an explicit SQLite DATABASE_URL.');
    assertPathInside(workerRoot, databaseUrl.slice('file:'.length));
    assertPathInside(workerRoot, paths.searchIndex);
    assertPathInside(workerRoot, paths.imageDir);
    assertPathInside(workerRoot, paths.embeddingApiKey);
});

test('one server test can persist database and file fixtures in its isolated state', async () => {
    requireTestWorkerRoot();

    await models.cache.create({ data: { key: TEST_CACHE_KEY, value: 'first-test' } });
    writeFileSync(path.join(paths.imageDir, 'first-test.txt'), 'first-test');

    assert.equal(await models.cache.count({ where: { key: TEST_CACHE_KEY } }), 1);
    assert.equal(existsSync(path.join(paths.imageDir, 'first-test.txt')), true);
});

test('the next server test starts with fresh database and file state', async () => {
    requireTestWorkerRoot();

    assert.equal(await models.cache.count({ where: { key: TEST_CACHE_KEY } }), 0);
    assert.equal(existsSync(path.join(paths.imageDir, 'first-test.txt')), false);
});
