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
                title: '다른 제목',
                searchableText: '다른 제목 점쟁이 죽는 이야기',
                updatedAt: new Date('2026-07-21T00:00:00.000Z'),
            },
            {
                id: 2,
                title: '점쟁이 죽는',
                searchableText: '점쟁이 죽는',
                updatedAt: new Date('2020-01-01T00:00:00.000Z'),
            },
        ],
        '점쟁이 죽는',
    );

    assert.deepEqual(
        candidates.map((candidate) => candidate.id),
        [2, 1],
    );
});

test('keeps partial lexical candidates for a vague multi-word query', () => {
    assert.equal(matchesHybridLexicalQuery('6년 안에 죽는거야 점집에서 들은 꿈', '점쟁이 죽는'), true);
    assert.equal(matchesHybridLexicalQuery('완전히 다른 기록', '점쟁이 죽는'), false);
    assert.equal(matchesHybridLexicalQuery('6년 안에 죽는거야 제외할 내용', '점쟁이 죽는 -제외할'), false);
});

test('ranks candidates containing every term ahead of partial content matches', () => {
    const candidates = rankLexicalCandidates(
        [
            {
                id: 1,
                title: '죽는 이야기',
                searchableText: '죽는 이야기',
                updatedAt: new Date('2026-07-21T00:00:00.000Z'),
            },
            {
                id: 2,
                title: '다른 제목',
                searchableText: '점쟁이와 죽는 이야기를 흐릿하게 기억한다',
                updatedAt: new Date('2020-01-01T00:00:00.000Z'),
            },
        ],
        '점쟁이 죽는',
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

    const result = await search({ query: '점쟁이 죽는', limit: 10, offset: 0 });

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

    const result = await search({ query: '검색', limit: 10, offset: 0 });

    assert.deepEqual(
        result.notes.map((note) => note.id),
        [2, 1],
    );
    assert.equal(result.semanticUsed, false);
    assert.equal(result.semanticError, 'Embedding API is offline.');
});
