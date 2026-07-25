import assert from 'node:assert/strict';
import test from 'node:test';
import type { Note } from '~/models.js';
import { createHybridNoteSearch, matchesHybridLexicalQuery, rankLexicalCandidates } from './hybrid-search.js';

const createNote = (id: number): Note =>
    ({
        id,
        title: `Note ${id}`,
        content: '[]',
        searchableText: '',
        searchableTextVersion: 1,
        createdAt: new Date('2026-07-21T00:00:00.000Z'),
        updatedAt: new Date('2026-07-21T00:00:00.000Z'),
        pinned: false,
        order: 0,
        layout: 'wide',
    }) as Note;

test('ranks exact title and phrase matches ahead of content-only matches', () => {
    const candidates = rankLexicalCandidates(
        [
            {
                id: 1,
                title: 'Another title',
                searchableText: 'Another title fortune teller death story',
                updatedAt: new Date('2026-07-21T00:00:00.000Z'),
            },
            {
                id: 2,
                title: 'Fortune teller death',
                searchableText: 'Fortune teller death',
                updatedAt: new Date('2020-01-01T00:00:00.000Z'),
            },
        ],
        'fortune teller death',
    );

    assert.deepEqual(
        candidates.map((candidate) => candidate.id),
        [2, 1],
    );
});

test('keeps partial lexical candidates for a vague multi-word query', () => {
    assert.equal(
        matchesHybridLexicalQuery(
            'A dream about dying in six years after visiting a fortune teller',
            'fortune teller death',
        ),
        true,
    );
    assert.equal(matchesHybridLexicalQuery('A completely unrelated record', 'fortune teller death'), false);
    assert.equal(
        matchesHybridLexicalQuery('A fortune teller death story with spoilers', 'fortune teller death -spoilers'),
        false,
    );
});

test('ranks candidates containing every term ahead of partial content matches', () => {
    const candidates = rankLexicalCandidates(
        [
            {
                id: 1,
                title: 'A story about death',
                searchableText: 'A story about death',
                updatedAt: new Date('2026-07-21T00:00:00.000Z'),
            },
            {
                id: 2,
                title: 'Another title',
                searchableText: 'A vague memory about a fortune teller and death',
                updatedAt: new Date('2020-01-01T00:00:00.000Z'),
            },
        ],
        'fortune teller death',
    );

    assert.deepEqual(
        candidates.map((candidate) => candidate.id),
        [2, 1],
    );
});

test('returns a semantic-only note through the same Ocean Brain note result surface', async () => {
    const search = createHybridNoteSearch({
        listLexicalNoteIds: async () => [],
        trySemanticSearch: async () => ({
            available: true,
            used: true,
            matches: [{ noteId: 7, distance: 0.48 }],
            error: null,
        }),
        findNotesByIds: async (ids) => ids.map(createNote),
    });

    const result = await search({ query: 'fortune teller death', limit: 10, offset: 0 });

    assert.deepEqual(
        result.notes.map((note) => note.id),
        [7],
    );
    assert.equal(result.semanticUsed, true);
});

test('keeps lexical search usable when the embedding API is unavailable', async () => {
    const search = createHybridNoteSearch({
        listLexicalNoteIds: async () => [2, 1],
        trySemanticSearch: async () => ({
            available: true,
            used: false,
            matches: [],
            error: 'Embedding API is offline.',
        }),
        findNotesByIds: async (ids) => [...ids].reverse().map(createNote),
    });

    const result = await search({ query: 'search', limit: 10, offset: 0 });

    assert.deepEqual(
        result.notes.map((note) => note.id),
        [2, 1],
    );
    assert.equal(result.semanticUsed, false);
    assert.equal(result.semanticError, 'Embedding API is offline.');
});

test('lexical mode does not call the embedding search dependency', async () => {
    let semanticCalls = 0;
    const search = createHybridNoteSearch({
        listLexicalNoteIds: async () => [2],
        trySemanticSearch: async () => {
            semanticCalls += 1;
            return {
                available: true,
                used: true,
                matches: [{ noteId: 7, distance: 0.2 }],
                error: null,
            };
        },
        findNotesByIds: async (ids) => ids.map(createNote),
    });

    const result = await search({ query: 'exact words', limit: 10, offset: 0, mode: 'lexical' });

    assert.equal(semanticCalls, 0);
    assert.deepEqual(
        result.notes.map((note) => note.id),
        [2],
    );
    assert.deepEqual(result.matches, [{ noteId: 2, lexical: true, semantic: false }]);
});

test('semantic mode does not call the lexical search dependency', async () => {
    let lexicalCalls = 0;
    const search = createHybridNoteSearch({
        listLexicalNoteIds: async () => {
            lexicalCalls += 1;
            return [2];
        },
        trySemanticSearch: async () => ({
            available: true,
            used: true,
            matches: [{ noteId: 7, distance: 0.2 }],
            error: null,
        }),
        findNotesByIds: async (ids) => ids.map(createNote),
    });

    const result = await search({ query: 'vague memory', limit: 10, offset: 0, mode: 'semantic' });

    assert.equal(lexicalCalls, 0);
    assert.deepEqual(
        result.notes.map((note) => note.id),
        [7],
    );
    assert.deepEqual(result.matches, [{ noteId: 7, lexical: false, semantic: true }]);
});

test('keeps every result within the ranked candidate window reachable through pagination', async () => {
    let requestedCandidateLimit = 0;
    const search = createHybridNoteSearch({
        listLexicalNoteIds: async (_query, limit) => {
            requestedCandidateLimit = limit;
            return Array.from({ length: limit }, (_, index) => index + 1);
        },
        trySemanticSearch: async () => ({
            available: false,
            used: false,
            matches: [],
            error: null,
        }),
        findNotesByIds: async (ids) => ids.map(createNote),
    });

    const result = await search({ query: 'common term', limit: 10, offset: 40, mode: 'lexical' });

    assert.equal(requestedCandidateLimit, 80);
    assert.equal(result.totalCount, 80);
    assert.deepEqual(
        result.notes.map((note) => note.id),
        [41, 42, 43, 44, 45, 46, 47, 48, 49, 50],
    );
});
