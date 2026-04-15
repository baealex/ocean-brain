import assert from 'node:assert/strict';
import test from 'node:test';

import { createDeleteImageMutationResolver } from './image.mutation.resolver.js';

test('deleteImage resolver returns the service result with a normalized id', async () => {
    let requestedId = 0;

    const resolver = createDeleteImageMutationResolver(async (id) => {
        requestedId = id;
        return true;
    });

    const result = await resolver(null, { id: '8' });

    assert.equal(requestedId, 8);
    assert.equal(result, true);
});

test('deleteImage resolver returns false when deletion throws', async () => {
    const writes: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
        writes.push(String(chunk));
        return true;
    }) as typeof process.stderr.write;

    try {
        const resolver = createDeleteImageMutationResolver(async () => {
            throw new Error('disk busy');
        });

        const result = await resolver(null, { id: '9' });

        assert.equal(result, false);
        assert.equal(
            writes.some((line) => line.includes('[image] Delete failed: disk busy')),
            true,
        );
    } finally {
        process.stderr.write = originalWrite;
    }
});
