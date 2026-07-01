import assert from 'node:assert/strict';
import test from 'node:test';

import { createNoteWriteService } from './write.js';
import { isMissingNoteVersionError, isNoteVersionConflictError } from './write-conflict.js';

const createNoteRecord = (input: { updatedAt: Date; title?: string; content?: string }) => ({
    id: 7,
    title: input.title ?? 'Existing',
    content: input.content ?? '[]',
    layout: 'wide' as const,
    createdAt: new Date('2026-03-31T00:00:00.000Z'),
    updatedAt: input.updatedAt,
    pinned: false,
    order: 0,
});

test('updateNoteWithVersionGuard updates using id and updatedAt when a version is provided', async () => {
    const calls: unknown[] = [];
    const existingUpdatedAt = new Date(1770000000000);
    const service = createNoteWriteService({
        findNoteForWrite: async () => createNoteRecord({ updatedAt: existingUpdatedAt }),
        findNoteVersion: async () => ({ updatedAt: existingUpdatedAt }),
        captureBaseline: async (input) => {
            calls.push({ captureBaseline: input });
        },
        updateNote: async (input) => {
            calls.push({ updateNote: input });
            return createNoteRecord({ updatedAt: new Date(1770000001000), title: input.data.title });
        },
        isRecordNotFoundError: () => false,
    });

    const updated = await service.updateNoteWithVersionGuard({
        id: 7,
        data: {
            title: 'Renamed',
            content: '[]',
            tagIds: [3],
        },
        editSessionId: 'session-1',
        expectedUpdatedAt: '1770000000000',
        snapshotMeta: '{"label":"Web browser"}',
    });

    assert.equal(updated?.title, 'Renamed');
    assert.deepEqual(calls, [
        {
            captureBaseline: {
                noteId: 7,
                baseline: {
                    id: 7,
                    title: 'Existing',
                    content: '[]',
                    pinned: false,
                    order: 0,
                    layout: 'wide',
                },
                editSessionId: 'session-1',
                meta: '{"label":"Web browser"}',
            },
        },
        {
            updateNote: {
                where: {
                    id: 7,
                    updatedAt: existingUpdatedAt,
                },
                data: {
                    title: 'Renamed',
                    content: '[]',
                    searchableText: 'renamed',
                    searchableTextVersion: 1,
                    tags: {
                        set: [{ id: 3 }],
                    },
                },
            },
        },
    ]);
});

test('updateNoteWithVersionGuard requires a note version unless forced', async () => {
    const service = createNoteWriteService({
        findNoteForWrite: async () => createNoteRecord({ updatedAt: new Date(1770000000000) }),
        findNoteVersion: async () => ({ updatedAt: new Date(1770000000000) }),
        captureBaseline: async () => undefined,
        updateNote: async () => createNoteRecord({ updatedAt: new Date(1770000001000) }),
        isRecordNotFoundError: () => false,
    });

    await assert.rejects(
        () =>
            service.updateNoteWithVersionGuard({
                id: 7,
                data: { title: 'Renamed' },
            }),
        (error) => {
            assert.equal(isMissingNoteVersionError(error), true);
            return true;
        },
    );
});

test('updateNoteWithVersionGuard allows explicit forced overwrites and snapshots the overwritten baseline', async () => {
    const calls: unknown[] = [];
    const service = createNoteWriteService({
        findNoteForWrite: async () => createNoteRecord({ updatedAt: new Date(1770000000000), title: 'Remote' }),
        findNoteVersion: async () => ({ updatedAt: new Date(1770000000000) }),
        captureBaseline: async (input) => {
            calls.push({ captureBaseline: input });
        },
        updateNote: async (input) => {
            calls.push({ updateNote: input });
            return createNoteRecord({ updatedAt: new Date(1770000001000), title: input.data.title });
        },
        isRecordNotFoundError: () => false,
    });

    await service.updateNoteWithVersionGuard({
        id: 7,
        data: { title: 'Overwrite' },
        editSessionId: 'session-1',
        force: true,
    });

    assert.deepEqual(calls, [
        {
            captureBaseline: {
                noteId: 7,
                baseline: {
                    id: 7,
                    title: 'Remote',
                    content: '[]',
                    pinned: false,
                    order: 0,
                    layout: 'wide',
                },
                force: true,
            },
        },
        {
            updateNote: {
                where: { id: 7 },
                data: {
                    title: 'Overwrite',
                    searchableText: 'overwrite',
                    searchableTextVersion: 1,
                },
            },
        },
    ]);
});

test('updateNoteWithVersionGuard does not update when baseline snapshot capture fails', async () => {
    let updateCalled = false;
    const snapshotError = new Error('snapshot failed');
    const service = createNoteWriteService({
        findNoteForWrite: async () => createNoteRecord({ updatedAt: new Date(1770000000000) }),
        findNoteVersion: async () => ({ updatedAt: new Date(1770000000000) }),
        captureBaseline: async () => {
            throw snapshotError;
        },
        updateNote: async () => {
            updateCalled = true;
            return createNoteRecord({ updatedAt: new Date(1770000001000) });
        },
        isRecordNotFoundError: () => false,
    });

    await assert.rejects(
        () =>
            service.updateNoteWithVersionGuard({
                id: 7,
                data: { title: 'Renamed' },
                expectedUpdatedAt: '1770000000000',
            }),
        (error) => {
            assert.equal(error, snapshotError);
            return true;
        },
    );
    assert.equal(updateCalled, false);
});

test('updateNoteWithVersionGuard maps stale conditional updates to domain conflicts', async () => {
    const service = createNoteWriteService({
        findNoteForWrite: async () => createNoteRecord({ updatedAt: new Date(1770000000000) }),
        findNoteVersion: async () => ({ updatedAt: new Date(1770000002000) }),
        captureBaseline: async () => undefined,
        updateNote: async () => {
            throw { code: 'P2025' };
        },
        isRecordNotFoundError: (error) => {
            return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025';
        },
    });

    await assert.rejects(
        () =>
            service.updateNoteWithVersionGuard({
                id: 7,
                data: { title: 'Renamed' },
                expectedUpdatedAt: '1770000000000',
            }),
        (error) => {
            assert.equal(isNoteVersionConflictError(error), true);
            assert.equal(isNoteVersionConflictError(error) ? error.currentUpdatedAt : '', '1770000002000');
            return true;
        },
    );
});

test('updateNoteWithVersionGuard returns null when the note disappears during a guarded update', async () => {
    const service = createNoteWriteService({
        findNoteForWrite: async () => createNoteRecord({ updatedAt: new Date(1770000000000) }),
        findNoteVersion: async () => null,
        captureBaseline: async () => undefined,
        updateNote: async () => {
            throw { code: 'P2025' };
        },
        isRecordNotFoundError: (error) => {
            return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025';
        },
    });

    const result = await service.updateNoteWithVersionGuard({
        id: 7,
        data: { title: 'Renamed' },
        expectedUpdatedAt: '1770000000000',
    });

    assert.equal(result, null);
});

test('updateNoteWithVersionGuard does not convert unrelated P2025 errors to conflicts', async () => {
    const p2025Error = { code: 'P2025' };
    const service = createNoteWriteService({
        findNoteForWrite: async () => createNoteRecord({ updatedAt: new Date(1770000000000) }),
        findNoteVersion: async () => ({ updatedAt: new Date(1770000000000) }),
        captureBaseline: async () => undefined,
        updateNote: async () => {
            throw p2025Error;
        },
        isRecordNotFoundError: (error) => error === p2025Error,
    });

    await assert.rejects(
        () =>
            service.updateNoteWithVersionGuard({
                id: 7,
                data: { tagIds: [999] },
                expectedUpdatedAt: '1770000000000',
            }),
        (error) => {
            assert.equal(error, p2025Error);
            return true;
        },
    );
});
