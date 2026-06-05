import assert from 'node:assert/strict';
import test from 'node:test';

import { createNoteSnapshotService, resolveRestoredSnapshotTags } from './snapshot.js';

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
    assert.deepEqual(trimCalls, [{ noteId: 7, keep: 10, limit: 100 }]);
});

test('restoreSnapshot reapplies payload and stores the current state first', async () => {
    const calls: string[] = [];
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
            calls.push('createSnapshot');
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
        trimOverflowSnapshots: async () => {
            calls.push('trimOverflowSnapshots');
            return 0;
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
                layout: 'wide',
            }),
            editSessionId: 'session-1',
            meta: '{"label":"Web browser"}',
            createdAt: new Date('2026-03-30T00:00:00.000Z'),
        }),
        updateNote: async (id, input) => {
            calls.push('updateNote');
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
    assert.deepEqual(calls, ['createSnapshot', 'updateNote', 'trimOverflowSnapshots']);
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

test('restoreSnapshot keeps existing snapshots when note update fails', async () => {
    let trimCallCount = 0;
    const service = createNoteSnapshotService({
        findNoteById: async () => ({
            id: 7,
            title: 'Current title',
            content: '{"type":"current"}',
            pinned: false,
            order: 0,
            layout: 'wide',
        }),
        findSnapshotByEditSessionId: async () => null,
        findLatestSnapshot: async () => null,
        createSnapshot: async (input) => ({
            id: 10,
            noteId: input.noteId,
            title: input.title,
            payload: input.payload,
            editSessionId: input.editSessionId ?? null,
            meta: input.meta ?? null,
            createdAt: new Date('2026-03-31T00:00:00.000Z'),
        }),
        purgeExpiredSnapshots: async () => 0,
        trimOverflowSnapshots: async () => {
            trimCallCount += 1;
            return 0;
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
                layout: 'wide',
            }),
            editSessionId: 'session-1',
            meta: '{"label":"Web browser"}',
            createdAt: new Date('2026-03-30T00:00:00.000Z'),
        }),
        updateNote: async () => {
            throw new Error('UPDATE_FAILED');
        },
    });

    await assert.rejects(() => service.restoreSnapshot(3), /UPDATE_FAILED/);
    assert.equal(trimCallCount, 0);
});

test('restoreSnapshot syncs tag relations from restored content', async () => {
    const restoredContent = JSON.stringify([
        {
            type: 'paragraph',
            content: [
                { type: 'tag', props: { id: '5', tag: '@restored' } },
                { type: 'text', text: ' and ', styles: {} },
                { type: 'tag', props: { id: '7', tag: '@second' } },
            ],
        },
    ]);
    const updated: Array<{
        id: number;
        input: {
            title: string;
            content: string;
            pinned: boolean;
            order: number;
            layout: 'narrow' | 'wide' | 'full';
            tagIds?: number[];
        };
    }> = [];

    const service = createNoteSnapshotService({
        findNoteById: async () => ({
            id: 7,
            title: 'Current title',
            content: JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text: 'Current', styles: {} }] }]),
            pinned: false,
            order: 0,
            layout: 'wide',
        }),
        findSnapshotByEditSessionId: async () => null,
        findLatestSnapshot: async () => null,
        createSnapshot: async (input) => ({
            id: 10,
            noteId: input.noteId,
            title: input.title,
            payload: input.payload,
            editSessionId: input.editSessionId ?? null,
            meta: input.meta ?? null,
            createdAt: new Date('2026-03-31T00:00:00.000Z'),
        }),
        purgeExpiredSnapshots: async () => 0,
        trimOverflowSnapshots: async () => 0,
        listSnapshots: async () => [],
        findSnapshotById: async () => ({
            id: 3,
            noteId: 7,
            title: 'Tagged title',
            payload: JSON.stringify({
                title: 'Tagged title',
                content: restoredContent,
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

    await service.restoreSnapshot(3, { meta: '{"label":"Web browser"}' });

    assert.deepEqual(updated, [
        {
            id: 7,
            input: {
                title: 'Tagged title',
                content: restoredContent,
                pinned: false,
                order: 0,
                layout: 'wide',
                tagIds: [5, 7],
            },
        },
    ]);
});

test('restoreSnapshot clears tag relations when restored content has no tags', async () => {
    const restoredContent = JSON.stringify([
        {
            type: 'paragraph',
            content: [{ type: 'text', text: 'No tags here', styles: {} }],
        },
    ]);
    const updated: Array<{
        id: number;
        input: {
            title: string;
            content: string;
            pinned: boolean;
            order: number;
            layout: 'narrow' | 'wide' | 'full';
            tagIds?: number[];
        };
    }> = [];

    const service = createNoteSnapshotService({
        findNoteById: async () => ({
            id: 7,
            title: 'Current title',
            content: JSON.stringify([
                {
                    type: 'paragraph',
                    content: [{ type: 'tag', props: { id: '5', tag: '@current' } }],
                },
            ]),
            pinned: false,
            order: 0,
            layout: 'wide',
        }),
        findSnapshotByEditSessionId: async () => null,
        findLatestSnapshot: async () => null,
        createSnapshot: async (input) => ({
            id: 10,
            noteId: input.noteId,
            title: input.title,
            payload: input.payload,
            editSessionId: input.editSessionId ?? null,
            meta: input.meta ?? null,
            createdAt: new Date('2026-03-31T00:00:00.000Z'),
        }),
        purgeExpiredSnapshots: async () => 0,
        trimOverflowSnapshots: async () => 0,
        listSnapshots: async () => [],
        findSnapshotById: async () => ({
            id: 3,
            noteId: 7,
            title: 'Untagged title',
            payload: JSON.stringify({
                title: 'Untagged title',
                content: restoredContent,
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

    await service.restoreSnapshot(3, { meta: '{"label":"Web browser"}' });

    assert.deepEqual(updated[0]?.input.tagIds, []);
});

test('resolveRestoredSnapshotTags ignores blank ids and restores missing tags by name', async () => {
    const content = JSON.stringify([
        {
            type: 'paragraph',
            content: [
                { type: 'tag', props: { id: '', tag: '@restored' } },
                { type: 'tag', props: { id: '0', tag: '@ignored-zero' } },
                { type: 'tag', props: { id: '7', tag: '@existing' } },
                { type: 'tag', props: { id: '404', tag: '@missing-id' } },
            ],
        },
    ]);

    const resolved = await resolveRestoredSnapshotTags(content, {
        findTagsByIds: async (ids) => ids.filter((id) => id === 7).map((id) => ({ id, name: '@existing' })),
        ensureTagByName: async (name) => ({
            id: name === '@restored' ? 5 : 6,
            name,
        }),
    });

    assert.deepEqual(resolved?.tagIds, [5, 6, 7]);
    assert.match(resolved?.content ?? '', /"id":"5"/);
    assert.match(resolved?.content ?? '', /"id":"6"/);
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

    assert.deepEqual(calls, ['purge', 'trim:10']);
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0]?.title, 'Current baseline');
});

test('listSnapshots returns lightweight readable content previews', async () => {
    const content = JSON.stringify([
        {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Visible snapshot body', styles: {} }],
        },
    ]);
    const service = createNoteSnapshotService({
        findNoteById: async () => null,
        findSnapshotByEditSessionId: async () => null,
        findLatestSnapshot: async () => null,
        createSnapshot: async () => {
            throw new Error('should not create');
        },
        purgeExpiredSnapshots: async () => 0,
        trimOverflowSnapshots: async () => 0,
        listSnapshots: async () => [
            {
                id: 9,
                noteId: 7,
                title: 'Readable baseline',
                payload: JSON.stringify({
                    title: 'Readable baseline',
                    content,
                    pinned: false,
                    order: 0,
                    layout: 'wide',
                }),
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

    assert.match(snapshots[0]?.contentPreview ?? '', /Visible snapshot body/);
    assert.equal(snapshots[0]?.contentAsMarkdown, undefined);
});

test('getSnapshot returns full markdown content for one snapshot', async () => {
    const content = JSON.stringify([
        {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Full snapshot body', styles: {} }],
        },
    ]);
    const service = createNoteSnapshotService({
        findNoteById: async () => null,
        findSnapshotByEditSessionId: async () => null,
        findLatestSnapshot: async () => null,
        createSnapshot: async () => {
            throw new Error('should not create');
        },
        purgeExpiredSnapshots: async () => 0,
        trimOverflowSnapshots: async () => 0,
        listSnapshots: async () => {
            throw new Error('should not list');
        },
        findSnapshotById: async () => ({
            id: 9,
            noteId: 7,
            title: 'Readable baseline',
            payload: JSON.stringify({
                title: 'Readable baseline',
                content,
                pinned: false,
                order: 0,
                layout: 'wide',
            }),
            editSessionId: null,
            meta: '{"label":"Web browser"}',
            createdAt: new Date('2026-03-31T00:00:00.000Z'),
        }),
        updateNote: async () => {
            throw new Error('should not update');
        },
    });

    const snapshot = await service.getSnapshot(9);

    assert.match(snapshot?.contentAsMarkdown ?? '', /Full snapshot body/);
    assert.match(snapshot?.contentPreview ?? '', /Full snapshot body/);
});

test('diffSnapshot compares a write baseline snapshot to the next snapshot', async () => {
    const firstContent = JSON.stringify([
        {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Before body', styles: {} }],
        },
    ]);
    const secondContent = JSON.stringify([
        {
            type: 'paragraph',
            content: [{ type: 'text', text: 'After body', styles: {} }],
        },
    ]);
    const snapshots = [
        {
            id: 1,
            noteId: 7,
            title: 'Before title',
            payload: JSON.stringify({
                title: 'Before title',
                content: firstContent,
                pinned: false,
                order: 0,
                layout: 'wide',
            }),
            editSessionId: null,
            meta: '{"label":"MCP"}',
            createdAt: new Date('2026-03-31T00:00:00.000Z'),
        },
        {
            id: 2,
            noteId: 7,
            title: 'After title',
            payload: JSON.stringify({
                title: 'After title',
                content: secondContent,
                pinned: false,
                order: 0,
                layout: 'wide',
            }),
            editSessionId: null,
            meta: '{"label":"MCP"}',
            createdAt: new Date('2026-03-31T00:01:00.000Z'),
        },
    ];
    const service = createNoteSnapshotService({
        findNoteById: async () => null,
        findSnapshotByEditSessionId: async () => null,
        findLatestSnapshot: async () => null,
        createSnapshot: async () => {
            throw new Error('should not create');
        },
        purgeExpiredSnapshots: async () => 0,
        trimOverflowSnapshots: async () => 0,
        listSnapshots: async () => snapshots,
        findSnapshotById: async (id) => snapshots.find((snapshot) => snapshot.id === id) ?? null,
        findNextSnapshot: async (snapshot) => snapshots.find((candidate) => candidate.id > snapshot.id) ?? null,
        updateNote: async () => {
            throw new Error('should not update');
        },
    });

    const diff = await service.diffSnapshot(1);

    assert.equal(diff?.mode, 'snapshot_to_snapshot');
    assert.equal(diff?.before.id, '1');
    assert.equal(diff?.after.id, '2');
    assert.match(diff?.diff.markdown ?? '', /Before body/);
    assert.match(diff?.diff.markdown ?? '', /After body/);
    assert.equal(diff?.diff.changedLineCount, 2);
});

test('diffSnapshot compares the latest snapshot to the current note when no next snapshot exists', async () => {
    const snapshotContent = JSON.stringify([
        {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Snapshot body', styles: {} }],
        },
    ]);
    const currentContent = JSON.stringify([
        {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Current body', styles: {} }],
        },
    ]);
    const snapshot = {
        id: 3,
        noteId: 7,
        title: 'Snapshot title',
        payload: JSON.stringify({
            title: 'Snapshot title',
            content: snapshotContent,
            pinned: false,
            order: 0,
            layout: 'wide',
        }),
        editSessionId: null,
        meta: null,
        createdAt: new Date('2026-03-31T00:00:00.000Z'),
    };
    const service = createNoteSnapshotService({
        findNoteById: async () => ({
            id: 7,
            title: 'Current title',
            content: currentContent,
            pinned: false,
            order: 0,
            layout: 'wide',
            updatedAt: new Date('2026-03-31T00:02:00.000Z'),
        }),
        findSnapshotByEditSessionId: async () => null,
        findLatestSnapshot: async () => null,
        createSnapshot: async () => {
            throw new Error('should not create');
        },
        purgeExpiredSnapshots: async () => 0,
        trimOverflowSnapshots: async () => 0,
        listSnapshots: async () => [snapshot],
        findSnapshotById: async () => snapshot,
        findNextSnapshot: async () => null,
        updateNote: async () => {
            throw new Error('should not update');
        },
    });

    const diff = await service.diffSnapshot(3);

    assert.equal(diff?.mode, 'snapshot_to_current');
    assert.equal(diff?.after.kind, 'current_note');
    assert.match(diff?.diff.markdown ?? '', /Snapshot body/);
    assert.match(diff?.diff.markdown ?? '', /Current body/);
});

test('diffSnapshot renders separate hunks for distant changes', async () => {
    const toContent = (...lines: string[]) =>
        JSON.stringify(
            lines.map((line) => ({
                type: 'paragraph',
                content: [{ type: 'text', text: line, styles: {} }],
            })),
        );
    const snapshots = [
        {
            id: 10,
            noteId: 7,
            title: 'Before title',
            payload: JSON.stringify({
                title: 'Before title',
                content: toContent('Top old', 'same 1', 'same 2', 'same 3', 'same 4', 'Bottom old'),
                pinned: false,
                order: 0,
                layout: 'wide',
            }),
            editSessionId: null,
            meta: null,
            createdAt: new Date('2026-03-31T00:00:00.000Z'),
        },
        {
            id: 11,
            noteId: 7,
            title: 'After title',
            payload: JSON.stringify({
                title: 'After title',
                content: toContent('Top new', 'same 1', 'same 2', 'same 3', 'same 4', 'Bottom new'),
                pinned: false,
                order: 0,
                layout: 'wide',
            }),
            editSessionId: null,
            meta: null,
            createdAt: new Date('2026-03-31T00:01:00.000Z'),
        },
    ];
    const service = createNoteSnapshotService({
        findNoteById: async () => null,
        findSnapshotByEditSessionId: async () => null,
        findLatestSnapshot: async () => null,
        createSnapshot: async () => {
            throw new Error('should not create');
        },
        purgeExpiredSnapshots: async () => 0,
        trimOverflowSnapshots: async () => 0,
        listSnapshots: async () => snapshots,
        findSnapshotById: async (id) => snapshots.find((snapshot) => snapshot.id === id) ?? null,
        findNextSnapshot: async (snapshot) => snapshots.find((candidate) => candidate.id > snapshot.id) ?? null,
        updateNote: async () => {
            throw new Error('should not update');
        },
    });

    const diff = await service.diffSnapshot(10, { contextLines: 1 });
    const hunkCount = diff?.diff.markdown.split('\n').filter((line) => line.startsWith('@@')).length;

    assert.equal(hunkCount, 2);
    assert.match(diff?.diff.markdown ?? '', /Top old/);
    assert.match(diff?.diff.markdown ?? '', /Bottom new/);
    assert.doesNotMatch(diff?.diff.markdown ?? '', /same 2/);
});
