import assert from 'node:assert/strict';
import test from 'node:test';
import models from '~/models.js';
import { createSearchNotesResolver, createSearchRelatedNotesResolver } from './resolver.js';

test('search excerpts show body matches beyond preview and never fabricate semantic lexical hits', async () => {
    const body = `${'İ'.repeat(400)}target-keyword matching passage`;
    const note = await models.note.create({
        data: {
            title: 'Long note',
            content: JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text: body }] }]),
        },
    });
    for (const lexical of [true, false]) {
        const resolver = createSearchNotesResolver(async () => ({
            totalCount: 1,
            notes: [note],
            matches: [{ noteId: note.id, lexical, semantic: true }],
            semanticAvailable: true,
            semanticUsed: true,
            semanticError: null,
        }));
        const result = await resolver(null, { query: 'target-keyword', pagination: { limit: 10, offset: 0 } });
        if (lexical) {
            assert.match(result.matches[0].excerpt?.text ?? '', /target-keyword/);
            assert.ok((result.matches[0].excerpt?.start ?? 0) > 100);
        } else assert.equal(result.matches[0].excerpt, null);
    }
});

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

test('searchRelatedNotes resolver validates the note id and bounds the result limit', async () => {
    let receivedInput: unknown;
    const resolver = createSearchRelatedNotesResolver(async (noteId, limit) => {
        receivedInput = { noteId, limit };
        return [];
    });

    await resolver(null, { noteId: '17', limit: 100 });

    assert.deepEqual(receivedInput, { noteId: 17, limit: 5 });
});

test('searchRelatedNotes resolver ignores invalid note ids', async () => {
    let called = false;
    const resolver = createSearchRelatedNotesResolver(async () => {
        called = true;
        return [];
    });

    assert.deepEqual(await resolver(null, { noteId: 'not-a-number', limit: 5 }), []);
    assert.equal(called, false);
});
