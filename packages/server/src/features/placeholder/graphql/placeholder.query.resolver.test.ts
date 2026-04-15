import assert from 'node:assert/strict';
import test from 'node:test';

import { createAllPlaceholdersQueryResolver, createPlaceholderQueryResolver } from './placeholder.query.resolver.js';

test('allPlaceholders resolver forwards search and pagination while keeping the legacy total count behavior', async () => {
    let findArgs: unknown;
    let counted = false;

    const resolver = createAllPlaceholdersQueryResolver({
        countPlaceholders: async () => {
            counted = true;
            return 9;
        },
        findPlaceholderById: async () => null,
        findPlaceholders: async (input) => {
            findArgs = input;
            return [
                {
                    id: 2,
                    name: 'Meeting title',
                    template: 'meeting-title',
                    replacement: 'Roadmap Sync',
                },
            ];
        },
    });

    const result = await resolver(null, {
        searchFilter: {
            query: 'Meeting',
        },
        pagination: {
            limit: 5,
            offset: 10,
        },
    });

    assert.equal(counted, true);
    assert.deepEqual(findArgs, {
        where: { name: { contains: 'Meeting' } },
        take: 5,
        skip: 10,
    });
    assert.equal(result.totalCount, 9);
    assert.deepEqual(result.placeholders, [
        {
            id: 2,
            name: 'Meeting title',
            template: 'meeting-title',
            replacement: 'Roadmap Sync',
        },
    ]);
});

test('placeholder resolver normalizes id input before lookup', async () => {
    let requestedId = 0;

    const resolver = createPlaceholderQueryResolver({
        findPlaceholderById: async (id) => {
            requestedId = id;
            return {
                id,
                name: 'Greeting',
                template: 'hello',
                replacement: 'Hello there',
            };
        },
    });

    const result = await resolver(null, { id: '14' });

    assert.equal(requestedId, 14);
    assert.deepEqual(result, {
        id: 14,
        name: 'Greeting',
        template: 'hello',
        replacement: 'Hello there',
    });
});
