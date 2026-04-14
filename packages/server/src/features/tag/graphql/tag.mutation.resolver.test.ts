import assert from 'node:assert/strict';
import test from 'node:test';

import { createTagMutationResolver } from './tag.mutation.resolver.js';

test('createTag mutation returns the canonical tag from the tag organization service', async () => {
    const resolver = createTagMutationResolver(async () => ({
        created: false,
        normalizedName: '@project',
        tag: {
            id: '12',
            name: '@project',
            createdAt: '2026-04-13T00:00:00.000Z',
            updatedAt: '2026-04-13T00:00:00.000Z',
        },
    }));

    const result = await resolver(null, { name: ' project ' });

    assert.deepEqual(result, {
        id: '12',
        name: '@project',
        createdAt: '2026-04-13T00:00:00.000Z',
        updatedAt: '2026-04-13T00:00:00.000Z',
    });
});
