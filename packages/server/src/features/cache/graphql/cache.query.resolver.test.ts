import assert from 'node:assert/strict';
import test from 'node:test';

import { createAllCachesQueryResolver, createCacheQueryResolver } from './cache.query.resolver.js';

test('allCaches resolver returns every cache row from the query service', async () => {
    const resolver = createAllCachesQueryResolver({
        findCaches: async () => [
            {
                id: 1,
                key: 'mcp.enabled',
                value: 'true',
            },
        ],
        findCacheByKey: async () => null,
    });

    const result = await resolver();

    assert.deepEqual(result, [
        {
            id: 1,
            key: 'mcp.enabled',
            value: 'true',
        },
    ]);
});

test('cache resolver forwards the cache key to the query service', async () => {
    let requestedKey = '';

    const resolver = createCacheQueryResolver({
        findCaches: async () => [],
        findCacheByKey: async (key) => {
            requestedKey = key;
            return {
                id: 2,
                key,
                value: 'false',
            };
        },
    });

    const result = await resolver(null, { key: 'mcp.enabled' });

    assert.equal(requestedKey, 'mcp.enabled');
    assert.deepEqual(result, {
        id: 2,
        key: 'mcp.enabled',
        value: 'false',
    });
});
