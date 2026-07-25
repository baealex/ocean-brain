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
            matches: [],
            semanticAvailable: false,
            semanticUsed: false,
            semanticError: null,
        };
    });

    await resolver(null, {
        query: 'fortune teller death',
        pagination: { limit: 100, offset: -2 },
    });

    assert.deepEqual(receivedInput, {
        query: 'fortune teller death',
        limit: 50,
        offset: 0,
        mode: 'hybrid',
    });
});

test('searchNotes resolver maps an explicit GraphQL search mode', async () => {
    let receivedInput: unknown;
    const resolver = createSearchNotesResolver(async (input) => {
        receivedInput = input;
        return {
            totalCount: 0,
            notes: [],
            matches: [],
            semanticAvailable: true,
            semanticUsed: true,
            semanticError: null,
        };
    });

    await resolver(null, {
        query: 'vague memory',
        pagination: { limit: 10, offset: 0 },
        mode: 'SEMANTIC',
    });

    assert.deepEqual(receivedInput, {
        query: 'vague memory',
        limit: 10,
        offset: 0,
        mode: 'semantic',
    });
});
