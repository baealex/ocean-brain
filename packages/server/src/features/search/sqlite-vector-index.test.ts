import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SqliteSemanticVectorIndex } from './sqlite-vector-index.js';

const profile = {
    model: 'test-embedding',
    dimensions: 2,
    queryInstruction: 'Retrieve relevant notes.',
    textSchemaVersion: 1,
};

test('stores vectors in a disposable SQLite file and returns one nearest match per note', async (t) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ocean-brain-search-index-'));
    const index = new SqliteSemanticVectorIndex(path.join(directory, 'search.sqlite3'));

    t.after(async () => {
        await index.close();
        await rm(directory, { recursive: true, force: true });
    });

    const status = await index.replaceAll(profile, [
        {
            noteId: 1,
            chunkIndex: 0,
            sourceHash: 'note-1',
            text: '점쟁이가 죽는 시기를 말했다.',
            embedding: [1, 0],
        },
        {
            noteId: 1,
            chunkIndex: 1,
            sourceHash: 'note-1',
            text: '같은 노트의 다른 조각',
            embedding: [0.9, 0.1],
        },
        {
            noteId: 2,
            chunkIndex: 0,
            sourceHash: 'note-2',
            text: '요리 프로그램에 대한 기록',
            embedding: [0, 1],
        },
    ]);

    assert.deepEqual(status, {
        ready: true,
        profile,
        noteCount: 2,
        chunkCount: 3,
        indexedAt: status.indexedAt,
    });
    assert.ok(status.indexedAt);

    const matches = await index.search([1, 0], 10);

    assert.deepEqual(
        matches.map((match) => match.noteId),
        [1, 2],
    );
    assert.equal(matches[0].distance, 0);
});

test('replaces the complete index and rejects a query from another embedding space', async (t) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ocean-brain-search-index-'));
    const index = new SqliteSemanticVectorIndex(path.join(directory, 'search.sqlite3'));

    t.after(async () => {
        await index.close();
        await rm(directory, { recursive: true, force: true });
    });

    await index.replaceAll(profile, [
        {
            noteId: 1,
            chunkIndex: 0,
            sourceHash: 'old',
            text: 'old',
            embedding: [1, 0],
        },
    ]);
    await index.replaceAll(profile, [
        {
            noteId: 2,
            chunkIndex: 0,
            sourceHash: 'new',
            text: 'new',
            embedding: [0, 1],
        },
    ]);

    assert.deepEqual(await index.search([1, 0], 10), [{ noteId: 2, distance: 1 }]);
    await assert.rejects(index.search([1, 0, 0], 10), /index requires 2/);
});
