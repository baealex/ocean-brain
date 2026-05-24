import assert from 'node:assert/strict';
import test from 'node:test';

import { createNoteWriteService } from './write.js';
import { isNoteVersionConflictError } from './write-conflict.js';

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
