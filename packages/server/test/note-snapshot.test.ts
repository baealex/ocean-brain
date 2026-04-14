import assert from 'node:assert/strict';
import test from 'node:test';

import { createNoteSnapshotService } from '../src/modules/note-snapshot.js';

test('captureBaseline stores one snapshot per note edit session', async () => {
    const snapshots: Array<{
        id: number;
        noteId: number;
        title: string;
        payload: string;
        editSessionId: string | null;
        meta: string | null;
        createdAt: Date;
    }> = [];

    const service = createNoteSnapshotService({
        findNoteById: async () => ({
            id: 7,
            title: 'Draft',
            content: '{"type":"doc"}',
            pinned: false,
            order: 0,
            layout: 'wide',
        }),
        findSnapshotByEditSessionId: async (noteId, editSessionId) => {
            return (
                snapshots.find((snapshot) => snapshot.noteId === noteId && snapshot.editSessionId === editSessionId) ??
                null
            );
        },
        findLatestSnapshot: async (noteId) => {
            return (
                snapshots
                    .filter((snapshot) => snapshot.noteId === noteId)
                    .sort((left, right) => right.id - left.id)[0] ?? null
            );
        },
        createSnapshot: async (input) => {
            const snapshot = {
                id: snapshots.length + 1,
                noteId: input.noteId,
                title: input.title,
                payload: input.payload,
                editSessionId: input.editSessionId ?? null,
                meta: input.meta ?? null,
                createdAt: new Date('2026-03-31T00:00:00.000Z'),
            };
            snapshots.push(snapshot);
            return snapshot;
        },
        purgeExpiredSnapshots: async () => 0,
        trimOverflowSnapshots: async () => 0,
        listSnapshots: async () => snapshots,
        findSnapshotById: async () => null,
        updateNote: async () => {
            throw new Error('should not restore');
        },
    });

    const first = await service.captureBaseline({
        noteId: 7,
        editSessionId: 'session-1',
        meta: '{"label":"Web browser"}',
    });
    const second = await service.captureBaseline({
        noteId: 7,
        editSessionId: 'session-1',
        meta: '{"label":"Web browser"}',
    });

    assert.equal(snapshots.length, 1);
    assert.equal(first?.id, '1');
    assert.equal(second?.id, '1');
});

test('captureBaseline skips creating a duplicate snapshot when another session already stored the same payload', async () => {
    const snapshots = [
        {
            id: 1,
            noteId: 7,
            title: 'Draft',
            payload: JSON.stringify({
                title: 'Draft',
                content: '{"type":"doc"}',
                pinned: false,
                order: 0,
                layout: 'wide',
            }),
            editSessionId: 'session-1',
            meta: '{"label":"Web browser"}',
            createdAt: new Date('2026-03-31T00:00:00.000Z'),
        },
    ];

    const service = createNoteSnapshotService({
        findNoteById: async () => ({
            id: 7,
            title: 'Draft',
            content: '{"type":"doc"}',
            pinned: false,
            order: 0,
            layout: 'wide',
        }),
        findSnapshotByEditSessionId: async () => null,
        findLatestSnapshot: async () => snapshots[0] ?? null,
        createSnapshot: async () => {
            throw new Error('should not create a duplicate snapshot');
        },
        purgeExpiredSnapshots: async () => 0,
        trimOverflowSnapshots: async () => 0,
        listSnapshots: async () => snapshots,
        findSnapshotById: async () => null,
        updateNote: async () => {
            throw new Error('should not restore');
        },
    });

    const snapshot = await service.captureBaseline({
        noteId: 7,
        editSessionId: 'session-2',
        meta: '{"label":"Web browser"}',
    });

    assert.equal(snapshot?.id, '1');
    assert.equal(snapshots.length, 1);
});

test('captureBaseline creates a new snapshot when the payload changed in a new session', async () => {
    const snapshots: Array<{
        id: number;
        noteId: number;
        title: string;
        payload: string;
        editSessionId: string | null;
        meta: string | null;
        createdAt: Date;
    }> = [
        {
            id: 1,
            noteId: 7,
            title: 'Draft',
            payload: JSON.stringify({
                title: 'Draft',
                content: '{"type":"previous"}',
                pinned: false,
                order: 0,
                layout: 'wide',
            }),
            editSessionId: 'session-1',
            meta: '{"label":"Web browser"}',
            createdAt: new Date('2026-03-31T00:00:00.000Z'),
        },
    ];
    const trimCalls: Array<{ noteId: number; keep: number; limit: number }> = [];

    const service = createNoteSnapshotService({
        findNoteById: async () => ({
            id: 7,
            title: 'Draft updated',
            content: '{"type":"current"}',
            pinned: false,
            order: 0,
            layout: 'wide',
        }),
        findSnapshotByEditSessionId: async () => null,
        findLatestSnapshot: async () => snapshots[snapshots.length - 1] ?? null,
        createSnapshot: async (input) => {
            const snapshot = {
                id: snapshots.length + 1,
                noteId: input.noteId,
                title: input.title,
                payload: input.payload,
                editSessionId: input.editSessionId ?? null,
                meta: input.meta ?? null,
                createdAt: new Date('2026-04-01T00:00:00.000Z'),
            };
            snapshots.push(snapshot);
            return snapshot;
        },
        purgeExpiredSnapshots: async () => 0,
        trimOverflowSnapshots: async (noteId, keep, limit) => {
            trimCalls.push({ noteId, keep, limit });
            return 0;
        },
        listSnapshots: async () => snapshots,
        findSnapshotById: async () => null,
        updateNote: async () => {
            throw new Error('should not restore');
        },
    });

    const snapshot = await service.captureBaseline({
        noteId: 7,
        editSessionId: 'session-2',
        meta: '{"label":"Web browser"}',
    });

    assert.equal(snapshot?.id, '2');
    assert.equal(snapshots.length, 2);
    assert.deepEqual(trimCalls, [{ noteId: 7, keep: 5, limit: 100 }]);
});

test('restoreSnapshot reapplies payload and stores the current state first', async () => {
    const createdSnapshots: Array<{
        id: number;
        noteId: number;
        title: string;
        payload: string;
        editSessionId: string | null;
        meta: string | null;
        createdAt: Date;
    }> = [];
    const updated: Array<{
        id: number;
        input: {
            title: string;
            content: string;
            pinned: boolean;
            order: number;
            layout: 'narrow' | 'wide' | 'full';
        };
    }> = [];

    const service = createNoteSnapshotService({
        findNoteById: async () => ({
            id: 7,
            title: 'Current title',
            content: '{"type":"current"}',
            pinned: true,
            order: 2,
            layout: 'full',
        }),
        findSnapshotByEditSessionId: async () => null,
        findLatestSnapshot: async () => null,
        createSnapshot: async (input) => {
            const snapshot = {
                id: createdSnapshots.length + 10,
                noteId: input.noteId,
                title: input.title,
                payload: input.payload,
                editSessionId: input.editSessionId ?? null,
                meta: input.meta ?? null,
                createdAt: new Date('2026-03-31T00:00:00.000Z'),
            };
            createdSnapshots.push(snapshot);
            return snapshot;
        },
        purgeExpiredSnapshots: async () => 0,
        trimOverflowSnapshots: async () => 0,
        listSnapshots: async () => [],
        findSnapshotById: async () => ({
            id: 3,
            noteId: 7,
            title: 'Previous title',
            payload: JSON.stringify({
                title: 'Previous title',
                content: '{"type":"previous"}',
                pinned: false,
                order: 0,
                layout: 'wide',
            }),
            editSessionId: 'session-1',
            meta: '{"label":"Web browser"}',
            createdAt: new Date('2026-03-30T00:00:00.000Z'),
        }),
        updateNote: async (id, input) => {
            updated.push({
                id,
                input,
            });
            return {
                id,
                title: input.title,
                content: input.content,
                pinned: input.pinned,
                order: input.order,
                layout: input.layout,
            };
        },
    });

    const restored = await service.restoreSnapshot(3, { meta: '{"label":"Web browser"}' });

    assert.equal(createdSnapshots.length, 1);
    assert.equal(createdSnapshots[0]?.title, 'Current title');
    assert.deepEqual(updated, [
        {
            id: 7,
            input: {
                title: 'Previous title',
                content: '{"type":"previous"}',
                pinned: false,
                order: 0,
                layout: 'wide',
            },
        },
    ]);
    assert.equal(restored?.title, 'Previous title');
});

test('restoreSnapshot skips saving a safety snapshot when the latest snapshot already matches the current note', async () => {
    const updated: Array<{
        id: number;
        input: {
            title: string;
            content: string;
            pinned: boolean;
            order: number;
            layout: 'narrow' | 'wide' | 'full';
        };
    }> = [];

    const currentPayload = JSON.stringify({
        title: 'Current title',
        content: '{"type":"current"}',
        pinned: true,
        order: 2,
        layout: 'full',
    });

    const service = createNoteSnapshotService({
        findNoteById: async () => ({
            id: 7,
            title: 'Current title',
            content: '{"type":"current"}',
            pinned: true,
            order: 2,
            layout: 'full',
        }),
        findSnapshotByEditSessionId: async () => null,
        findLatestSnapshot: async () => ({
            id: 9,
            noteId: 7,
            title: 'Current title',
            payload: currentPayload,
            editSessionId: 'session-2',
            meta: '{"label":"Web browser"}',
            createdAt: new Date('2026-03-31T00:00:00.000Z'),
        }),
        createSnapshot: async () => {
            throw new Error('should not create a duplicate safety snapshot');
        },
        purgeExpiredSnapshots: async () => 0,
        trimOverflowSnapshots: async () => 0,
        listSnapshots: async () => [],
        findSnapshotById: async () => ({
            id: 3,
            noteId: 7,
            title: 'Previous title',
            payload: JSON.stringify({
                title: 'Previous title',
                content: '{"type":"previous"}',
                pinned: false,
                order: 0,
                layout: 'wide',
            }),
            editSessionId: 'session-1',
            meta: '{"label":"Web browser"}',
            createdAt: new Date('2026-03-30T00:00:00.000Z'),
        }),
        updateNote: async (id, input) => {
            updated.push({ id, input });
            return {
                id,
                title: input.title,
                content: input.content,
                pinned: input.pinned,
                order: input.order,
                layout: input.layout,
            };
        },
    });

    const restored = await service.restoreSnapshot(3, { meta: '{"label":"Web browser"}' });

    assert.deepEqual(updated, [
        {
            id: 7,
            input: {
                title: 'Previous title',
                content: '{"type":"previous"}',
                pinned: false,
                order: 0,
                layout: 'wide',
            },
        },
    ]);
    assert.equal(restored?.title, 'Previous title');
});

test('listSnapshots runs retention cleanup before returning recent snapshots', async () => {
    const calls: string[] = [];
    const service = createNoteSnapshotService({
        findNoteById: async () => null,
        findSnapshotByEditSessionId: async () => null,
        findLatestSnapshot: async () => null,
        createSnapshot: async () => {
            throw new Error('should not create');
        },
        purgeExpiredSnapshots: async () => {
            calls.push('purge');
            return 1;
        },
        trimOverflowSnapshots: async (_noteId, keep, _limit) => {
            calls.push(`trim:${keep}`);
            return 1;
        },
        listSnapshots: async () => [
            {
                id: 9,
                noteId: 7,
                title: 'Current baseline',
                payload: '{}',
                editSessionId: null,
                meta: '{"label":"Web browser"}',
                createdAt: new Date('2026-03-31T00:00:00.000Z'),
            },
        ],
        findSnapshotById: async () => null,
        updateNote: async () => {
            throw new Error('should not update');
        },
    });

    const snapshots = await service.listSnapshots(7, 5);

    assert.deepEqual(calls, ['purge', 'trim:5']);
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0]?.title, 'Current baseline');
});
