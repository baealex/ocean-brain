import assert from 'node:assert/strict';
import test from 'node:test';
import { fuseHybridSearchRanks } from './hybrid-ranking.js';

test('keeps semantic-only candidates instead of applying a hard similarity threshold', () => {
    const results = fuseHybridSearchRanks({
        lexicalNoteIds: [],
        semanticNoteIds: [7, 3, 9],
    });

    assert.deepEqual(
        results.map((result) => result.noteId),
        [7, 3, 9],
    );
});

test('raises notes found by both lexical and semantic retrieval', () => {
    const results = fuseHybridSearchRanks({
        lexicalNoteIds: [1, 2, 3],
        semanticNoteIds: [3, 4, 5],
    });

    assert.equal(results[0].noteId, 3);
    assert.deepEqual(
        { lexicalRank: results[0].lexicalRank, semanticRank: results[0].semanticRank },
        { lexicalRank: 3, semanticRank: 1 },
    );
});

test('deduplicates repeated chunk matches before combining ranks', () => {
    const results = fuseHybridSearchRanks({
        lexicalNoteIds: [2, 2, 1],
        semanticNoteIds: [3, 3, 2],
    });

    assert.deepEqual(
        results.map((result) => result.noteId).sort((left, right) => left - right),
        [1, 2, 3],
    );
});
