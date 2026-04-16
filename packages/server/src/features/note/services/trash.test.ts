import assert from 'node:assert/strict';
import test from 'node:test';

import { createNoteTrashService, NoteRestoreConflictError } from './trash.js';

test('note trash service moves a live note to trash and returns a summary', async () => {
    const movedIds: number[] = [];
    const service = createNoteTrashService({
        countDeletedNotes: async () => 1,
        findDeletedNote: async () => null,
        findLiveNote: async (id) => ({
            id,
            title: 'Temp note',
            content: 'content',
            createdAt: new Date('2026-03-01T00:00:00.000Z'),
            updatedAt: new Date('2026-03-10T12:00:00.000Z'),
            pinned: false,
            order: 0,
            layout: 'wide',
            tags: [
                {
                    id: 1,
                    name: 'temp',
                },
                {
                    id: 2,
                    name: 'cleanup',
                },
            ],
            reminders: [],
        }),
        listDeletedNotes: async () => [],
        liveNoteExists: async () => false,
        moveNoteToTrash: async (note) => {
            movedIds.push(note.id);
            return {
                ...note,
                deletedAt: new Date('2026-03-31T01:00:00.000Z'),
                tags: note.tags.map((tag) => ({ name: tag.name })),
                reminders: [],
            };
        },
        purgeDeletedNote: async () => {
            throw new Error('purge should not run');
        },
        purgeExpiredDeletedNotes: async () => 0,
        restoreDeletedNote: async () => {
            throw new Error('restore should not run');
        },
    });

    const trashed = await service.trashNoteById(7);

    assert.deepEqual(movedIds, [7]);
    assert.deepEqual(trashed, {
        id: '7',
        title: 'Temp note',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-10T12:00:00.000Z',
        deletedAt: '2026-03-31T01:00:00.000Z',
        pinned: false,
        order: 0,
        layout: 'wide',
        tagNames: ['temp', 'cleanup'],
    });
});

test('note trash service restores a deleted note', async () => {
    const restoredIds: number[] = [];
    const service = createNoteTrashService({
        countDeletedNotes: async () => 1,
        findDeletedNote: async (id) => ({
            id,
            title: 'Recovered note',
            content: 'content',
            createdAt: new Date('2026-03-01T00:00:00.000Z'),
            updatedAt: new Date('2026-03-10T12:00:00.000Z'),
            deletedAt: new Date('2026-03-31T01:00:00.000Z'),
            pinned: true,
            order: 2,
            layout: 'full',
            tags: [{ name: 'restored' }],
            reminders: [],
        }),
        findLiveNote: async () => null,
        listDeletedNotes: async () => [],
        liveNoteExists: async () => false,
        moveNoteToTrash: async () => {
            throw new Error('trash should not run');
        },
        purgeDeletedNote: async () => {
            throw new Error('purge should not run');
        },
        purgeExpiredDeletedNotes: async () => 0,
        restoreDeletedNote: async (note) => {
            restoredIds.push(note.id);
            return {
                id: note.id,
                title: note.title,
                content: note.content,
                createdAt: note.createdAt,
                updatedAt: note.updatedAt,
                pinned: note.pinned,
                order: note.order,
                layout: note.layout,
            };
        },
    });

    const restored = await service.restoreNoteById(9);

    assert.deepEqual(restoredIds, [9]);
    assert.equal(restored?.id, 9);
    assert.equal(restored?.title, 'Recovered note');
    assert.equal(restored?.layout, 'full');
});

test('note trash service rejects restore when the live note id already exists', async () => {
    const service = createNoteTrashService({
        countDeletedNotes: async () => 0,
        findDeletedNote: async (id) => ({
            id,
            title: 'Conflict note',
            content: 'content',
            createdAt: new Date('2026-03-01T00:00:00.000Z'),
            updatedAt: new Date('2026-03-10T12:00:00.000Z'),
            deletedAt: new Date('2026-03-31T01:00:00.000Z'),
            pinned: false,
            order: 0,
            layout: 'wide',
            tags: [],
            reminders: [],
        }),
        findLiveNote: async () => null,
        listDeletedNotes: async () => [],
        liveNoteExists: async () => true,
        moveNoteToTrash: async () => {
            throw new Error('trash should not run');
        },
        purgeDeletedNote: async () => {
            throw new Error('purge should not run');
        },
        purgeExpiredDeletedNotes: async () => 0,
        restoreDeletedNote: async () => {
            throw new Error('restore should not run');
        },
    });

    await assert.rejects(
        () => service.restoreNoteById(11),
        (error: unknown) => error instanceof NoteRestoreConflictError,
    );
});

test('listTrashedNotes runs retention cleanup before returning trash data', async () => {
    const calls: string[] = [];
    const service = createNoteTrashService({
        countDeletedNotes: async () => 1,
        findDeletedNote: async () => null,
        findLiveNote: async () => null,
        listDeletedNotes: async () => [
            {
                id: 4,
                title: 'Old deleted note',
                content: 'content',
                createdAt: new Date('2026-03-01T00:00:00.000Z'),
                updatedAt: new Date('2026-03-10T12:00:00.000Z'),
                deletedAt: new Date('2026-03-31T01:00:00.000Z'),
                pinned: false,
                order: 0,
                layout: 'wide',
                tags: [],
                reminders: [],
            },
        ],
        liveNoteExists: async () => false,
        moveNoteToTrash: async () => {
            throw new Error('trash should not run');
        },
        purgeDeletedNote: async () => {
            throw new Error('purge should not run');
        },
        purgeExpiredDeletedNotes: async () => {
            calls.push('purge');
            return 1;
        },
        restoreDeletedNote: async () => {
            throw new Error('restore should not run');
        },
    });

    const result = await service.listTrashedNotes({
        limit: 25,
        offset: 0,
    });

    assert.deepEqual(calls, ['purge']);
    assert.equal(result.totalCount, 1);
    assert.equal(result.notes[0]?.title, 'Old deleted note');
});

test('note trash service permanently deletes a trashed note', async () => {
    const calls: string[] = [];
    const service = createNoteTrashService({
        countDeletedNotes: async () => 0,
        findDeletedNote: async (id) => ({
            id,
            title: 'Disposable note',
            content: 'content',
            createdAt: new Date('2026-03-01T00:00:00.000Z'),
            updatedAt: new Date('2026-03-10T12:00:00.000Z'),
            deletedAt: new Date('2026-03-31T01:00:00.000Z'),
            pinned: false,
            order: 0,
            layout: 'wide',
            tags: [{ name: 'trash' }],
            reminders: [],
        }),
        findLiveNote: async () => null,
        listDeletedNotes: async () => [],
        liveNoteExists: async () => false,
        moveNoteToTrash: async () => {
            throw new Error('trash should not run');
        },
        purgeDeletedNote: async (note) => {
            calls.push(`purge:${note.id}`);
        },
        purgeExpiredDeletedNotes: async () => {
            calls.push('retention');
            return 0;
        },
        restoreDeletedNote: async () => {
            throw new Error('restore should not run');
        },
    });

    const purged = await service.purgeNoteById(12);

    assert.deepEqual(calls, ['retention', 'purge:12']);
    assert.deepEqual(purged, {
        id: '12',
        title: 'Disposable note',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-10T12:00:00.000Z',
        deletedAt: '2026-03-31T01:00:00.000Z',
        pinned: false,
        order: 0,
        layout: 'wide',
        tagNames: ['trash'],
    });
});

test('note trash service returns null when purging a missing trashed note', async () => {
    const calls: string[] = [];
    const service = createNoteTrashService({
        countDeletedNotes: async () => 0,
        findDeletedNote: async () => null,
        findLiveNote: async () => null,
        listDeletedNotes: async () => [],
        liveNoteExists: async () => false,
        moveNoteToTrash: async () => {
            throw new Error('trash should not run');
        },
        purgeDeletedNote: async () => {
            throw new Error('purge should not run');
        },
        purgeExpiredDeletedNotes: async () => {
            calls.push('retention');
            return 0;
        },
        restoreDeletedNote: async () => {
            throw new Error('restore should not run');
        },
    });

    const purged = await service.purgeNoteById(404);

    assert.deepEqual(calls, ['retention']);
    assert.equal(purged, null);
});
