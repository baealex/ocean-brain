import assert from 'node:assert/strict';
import test from 'node:test';

import { createDeleteCacheMutationResolver, createSetCacheMutationResolver } from './cache.mutation.resolver.js';

test('setCache resolver updates an existing cache row after decoding the stored value', async () => {
    let updatedInput: unknown;

    const resolver = createSetCacheMutationResolver({
        findCacheByKey: async (key) => ({
            id: 1,
            key,
            value: 'old',
        }),
        createCache: async (input) => ({
            id: 0,
            ...input,
        }),
        updateCache: async (input) => {
            updatedInput = input;
            return {
                id: 1,
                ...input,
            };
        },
        deleteCache: async () => undefined,
    });

    const result = await resolver(null, {
        key: 'mcp.enabled',
        value: encodeURIComponent('true value'),
    });

    assert.deepEqual(updatedInput, {
        key: 'mcp.enabled',
        value: 'true value',
    });
    assert.deepEqual(result, {
        id: 1,
        key: 'mcp.enabled',
        value: 'true value',
    });
});

test('setCache resolver creates a cache row when the key does not exist', async () => {
    let createdInput: unknown;

    const resolver = createSetCacheMutationResolver({
        findCacheByKey: async () => null,
        createCache: async (input) => {
            createdInput = input;
            return {
                id: 3,
                ...input,
            };
        },
        updateCache: async (input) => ({
            id: 0,
            ...input,
        }),
        deleteCache: async () => undefined,
    });

    const result = await resolver(null, {
        key: 'workspace.title',
        value: encodeURIComponent('Ocean Brain'),
    });

    assert.deepEqual(createdInput, {
        key: 'workspace.title',
        value: 'Ocean Brain',
    });
    assert.deepEqual(result, {
        id: 3,
        key: 'workspace.title',
        value: 'Ocean Brain',
    });
});

test('deleteCache resolver deletes the cache row and returns true', async () => {
    let deletedKey = '';

    const resolver = createDeleteCacheMutationResolver({
        findCacheByKey: async () => null,
        createCache: async (input) => ({
            id: 0,
            ...input,
        }),
        updateCache: async (input) => ({
            id: 0,
            ...input,
        }),
        deleteCache: async (key) => {
            deletedKey = key;
        },
    });

    const result = await resolver(null, { key: 'mcp.enabled' });

    assert.equal(deletedKey, 'mcp.enabled');
    assert.equal(result, true);
});
