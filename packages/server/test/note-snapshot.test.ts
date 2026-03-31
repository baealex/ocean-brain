import test from 'node:test';
import assert from 'node:assert/strict';

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
            layout: 'wide'
        }),
        findSnapshotByEditSessionId: async (noteId, editSessionId) => {
            return snapshots.find((snapshot) => snapshot.noteId === noteId && snapshot.editSessionId === editSessionId) ?? null;
        },
        createSnapshot: async (input) => {
            const snapshot = {
                id: snapshots.length + 1,
                noteId: input.noteId,
                title: input.title,
                payload: input.payload,
                editSessionId: input.editSessionId ?? null,
                meta: input.meta ?? null,
                createdAt: new Date('2026-03-31T00:00:00.000Z')
            };
            snapshots.push(snapshot);
            return snapshot;
        },
        listSnapshots: async () => snapshots,
        findSnapshotById: async () => null,
        updateNote: async () => {
            throw new Error('should not restore');
        }
    });

    const first = await service.captureBaseline({
        noteId: 7,
        editSessionId: 'session-1',
        meta: '{"label":"Web browser"}'
    });
    const second = await service.captureBaseline({
        noteId: 7,
        editSessionId: 'session-1',
        meta: '{"label":"Web browser"}'
    });

    assert.equal(snapshots.length, 1);
    assert.equal(first?.id, '1');
    assert.equal(second?.id, '1');
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
            layout: 'full'
        }),
        findSnapshotByEditSessionId: async () => null,
        createSnapshot: async (input) => {
            const snapshot = {
                id: createdSnapshots.length + 10,
                noteId: input.noteId,
                title: input.title,
                payload: input.payload,
                editSessionId: input.editSessionId ?? null,
                meta: input.meta ?? null,
                createdAt: new Date('2026-03-31T00:00:00.000Z')
            };
            createdSnapshots.push(snapshot);
            return snapshot;
        },
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
                layout: 'wide'
            }),
            editSessionId: 'session-1',
            meta: '{"label":"Web browser"}',
            createdAt: new Date('2026-03-30T00:00:00.000Z')
        }),
        updateNote: async (id, input) => {
            updated.push({
                id,
                input
            });
            return {
                id,
                title: input.title,
                content: input.content,
                pinned: input.pinned,
                order: input.order,
                layout: input.layout
            };
        }
    });

    const restored = await service.restoreSnapshot(3, { meta: '{"label":"Web browser"}' });

    assert.equal(createdSnapshots.length, 1);
    assert.equal(createdSnapshots[0]?.title, 'Current title');
    assert.deepEqual(updated, [{
        id: 7,
        input: {
            title: 'Previous title',
            content: '{"type":"previous"}',
            pinned: false,
            order: 0,
            layout: 'wide'
        }
    }]);
    assert.equal(restored?.title, 'Previous title');
});
