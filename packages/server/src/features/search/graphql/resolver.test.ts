import assert from 'node:assert/strict';
import test from 'node:test';
import { createSearchNotesResolver } from './resolver.js';

test('searchNotes resolver passes a bounded page request to hybrid search', async () => {
    let receivedInput: unknown;
    const resolver = createSearchNotesResolver(async (input) => {
        receivedInput = input;
        return {
            totalCount: 0,
            notes: [],
            semanticAvailable: false,
            semanticUsed: false,
            semanticError: null,
        };
    });

    await resolver(null, {
        query: '점쟁이 죽는',
        pagination: { limit: 100, offset: -2 },
    });

    assert.deepEqual(receivedInput, {
        query: '점쟁이 죽는',
        limit: 50,
        offset: 0,
    });
});
