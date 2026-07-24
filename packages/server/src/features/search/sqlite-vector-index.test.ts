import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sqlite3 from 'sqlite3';
import { SqliteSemanticVectorIndex } from './sqlite-vector-index.js';

const profile = {
    model: 'test-embedding',
    baseUrl: 'http://127.0.0.1:1234/v1',
    dimensions: 2,
    queryInstruction: 'Retrieve relevant notes.',
    textSchemaVersion: 1,
};

const setDatabaseSchemaVersion = (filePath: string, version: number) => {
    return new Promise<void>((resolve, reject) => {
        const database = new sqlite3.Database(filePath);
        database.run(`PRAGMA user_version = ${version}`, (error) => {
            database.close((closeError) => {
                if (error || closeError) {
                    reject(error ?? closeError);
                    return;
                }
                resolve();
            });
        });
    });
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
            text: 'The fortune teller predicted a time of death.',
            embedding: [1, 0],
        },
        {
            noteId: 1,
            chunkIndex: 1,
            sourceHash: 'note-1',
            text: 'Another chunk from the same note',
            embedding: [0.9, 0.1],
        },
        {
            noteId: 2,
            chunkIndex: 0,
            sourceHash: 'note-2',
            text: 'Notes about a cooking show',
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

test('updates and removes individual notes without rebuilding the complete index', async (t) => {
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
            sourceHash: 'note-1-old',
            text: 'old',
            embedding: [1, 0],
        },
        {
            noteId: 2,
            chunkIndex: 0,
            sourceHash: 'note-2',
            text: 'keep',
            embedding: [0, 1],
        },
    ]);

    const updated = await index.replaceNote(1, [
        {
            noteId: 1,
            chunkIndex: 0,
            sourceHash: 'note-1-new',
            text: 'new',
            embedding: [0.8, 0.2],
        },
    ]);

    assert.equal(await index.getNoteSourceHash(1), 'note-1-new');
    assert.equal(updated.noteCount, 2);
    assert.equal(updated.chunkCount, 2);

    const removed = await index.removeNote(2);

    assert.equal(await index.getNoteSourceHash(2), null);
    assert.equal(removed.noteCount, 1);
    assert.equal(removed.chunkCount, 1);
});

test('persists and coalesces delayed note sync work across database restarts', async (t) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ocean-brain-search-index-'));
    const databasePath = path.join(directory, 'search.sqlite3');
    const index = new SqliteSemanticVectorIndex(databasePath);

    t.after(async () => {
        await index.close();
        await rm(directory, { recursive: true, force: true });
    });

    await index.enqueueNoteSync(1, 1_000);
    await index.enqueueNoteSync(1, 5_000);

    assert.deepEqual(
        await index.listPendingNoteSyncs({
            now: 14_999,
            quietPeriodMs: 10_000,
            maxWaitMs: 60_000,
            limit: 20,
        }),
        [],
    );

    await index.close();
    const reopenedIndex = new SqliteSemanticVectorIndex(databasePath);
    const ready = await reopenedIndex.listPendingNoteSyncs({
        now: 15_000,
        quietPeriodMs: 10_000,
        maxWaitMs: 60_000,
        limit: 20,
    });

    assert.equal(ready.length, 1);
    assert.equal(ready[0]?.noteId, 1);
    assert.equal(ready[0]?.version, 2);
    assert.equal((await reopenedIndex.getNoteSyncQueueStatus()).pendingNoteCount, 1);

    await reopenedIndex.close();
});

test('keeps a newer note change queued when an older sync finishes', async (t) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ocean-brain-search-index-'));
    const index = new SqliteSemanticVectorIndex(path.join(directory, 'search.sqlite3'));

    t.after(async () => {
        await index.close();
        await rm(directory, { recursive: true, force: true });
    });

    await index.enqueueNoteSync(1, 1_000);
    const [claimed] = await index.listPendingNoteSyncs({
        now: 61_000,
        quietPeriodMs: 10_000,
        maxWaitMs: 60_000,
        limit: 20,
    });
    assert.ok(claimed);

    await index.enqueueNoteSync(1, 62_000);
    await index.completeNoteSyncs([claimed], 63_000);

    const queueStatus = await index.getNoteSyncQueueStatus();
    const remaining = await index.listPendingNoteSyncs({
        now: 63_000,
        quietPeriodMs: 10_000,
        maxWaitMs: 60_000,
        limit: 20,
        force: true,
    });

    assert.equal(queueStatus.pendingNoteCount, 1);
    assert.equal(queueStatus.lastSyncedAt, new Date(63_000).toISOString());
    assert.equal(remaining[0]?.version, 2);
});

test('makes continuously edited notes eligible after the maximum wait', async (t) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ocean-brain-search-index-'));
    const index = new SqliteSemanticVectorIndex(path.join(directory, 'search.sqlite3'));

    t.after(async () => {
        await index.close();
        await rm(directory, { recursive: true, force: true });
    });

    await index.enqueueNoteSync(1, 1_000);
    await index.enqueueNoteSync(1, 59_000);

    const ready = await index.listPendingNoteSyncs({
        now: 61_000,
        quietPeriodMs: 10_000,
        maxWaitMs: 60_000,
        limit: 20,
    });

    assert.equal(ready[0]?.noteId, 1);
});

test('delays failed note sync work until its retry time', async (t) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ocean-brain-search-index-'));
    const index = new SqliteSemanticVectorIndex(path.join(directory, 'search.sqlite3'));

    t.after(async () => {
        await index.close();
        await rm(directory, { recursive: true, force: true });
    });

    await index.enqueueNoteSync(1, 1_000);
    const [claimed] = await index.listPendingNoteSyncs({
        now: 1_000,
        quietPeriodMs: 0,
        maxWaitMs: 60_000,
        limit: 20,
    });
    assert.ok(claimed);
    await index.failNoteSyncs([claimed], 'provider unavailable', 16_000);

    const beforeRetry = await index.listPendingNoteSyncs({
        now: 15_999,
        quietPeriodMs: 0,
        maxWaitMs: 60_000,
        limit: 20,
    });
    const atRetry = await index.listPendingNoteSyncs({
        now: 16_000,
        quietPeriodMs: 0,
        maxWaitMs: 60_000,
        limit: 20,
    });
    const queueStatus = await index.getNoteSyncQueueStatus();

    assert.deepEqual(beforeRetry, []);
    assert.equal(atRetry[0]?.attemptCount, 1);
    assert.equal(queueStatus.error, 'provider unavailable');
});

test('recreates disposable search tables when the database schema version changes', async (t) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ocean-brain-search-index-'));
    const databasePath = path.join(directory, 'search.sqlite3');
    const index = new SqliteSemanticVectorIndex(databasePath);

    t.after(async () => {
        await index.close();
        await rm(directory, { recursive: true, force: true });
    });

    await index.replaceAll(profile, [
        {
            noteId: 1,
            chunkIndex: 0,
            sourceHash: 'before-schema-change',
            text: 'Disposable search data',
            embedding: [1, 0],
        },
    ]);
    await index.enqueueNoteSync(1, 1_000);
    await index.close();
    await setDatabaseSchemaVersion(databasePath, 999);

    const reopenedIndex = new SqliteSemanticVectorIndex(databasePath);
    const [status, queueStatus] = await Promise.all([
        reopenedIndex.getStatus(),
        reopenedIndex.getNoteSyncQueueStatus(),
    ]);

    assert.equal(status.ready, false);
    assert.equal(status.noteCount, 0);
    assert.equal(queueStatus.pendingNoteCount, 0);
    await reopenedIndex.close();
});
