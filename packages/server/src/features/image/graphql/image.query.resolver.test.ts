import assert from 'node:assert/strict';
import test from 'node:test';

import { createAllImagesQueryResolver, createImageQueryResolver } from './image.query.resolver.js';

test('allImages resolver applies pagination and returns the counted total', async () => {
    let counted = false;
    let findArgs: unknown;

    const resolver = createAllImagesQueryResolver({
        countImages: async () => {
            counted = true;
            return 7;
        },
        findImageById: async () => null,
        findImages: async (input) => {
            findArgs = input;
            return [
                { id: 3, url: '/assets/images/2026/4/15/three.png' },
                { id: 2, url: '/assets/images/2026/4/15/two.png' },
            ];
        },
    });

    const result = await resolver(null, {
        pagination: {
            limit: 2,
            offset: 4,
        },
    });

    assert.equal(counted, true);
    assert.deepEqual(findArgs, {
        skip: 4,
        take: 2,
        orderBy: { createdAt: 'desc' },
    });
    assert.equal(result.totalCount, 7);
    assert.deepEqual(result.images, [
        { id: 3, url: '/assets/images/2026/4/15/three.png' },
        { id: 2, url: '/assets/images/2026/4/15/two.png' },
    ]);
});

test('image resolver normalizes the id before lookup', async () => {
    let requestedId = 0;

    const resolver = createImageQueryResolver({
        findImageById: async (id) => {
            requestedId = id;
            return { id, url: '/assets/images/2026/4/15/one.png' };
        },
    });

    const result = await resolver(null, { id: '41' });

    assert.equal(requestedId, 41);
    assert.deepEqual(result, {
        id: 41,
        url: '/assets/images/2026/4/15/one.png',
    });
});
