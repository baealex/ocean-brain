import test from 'node:test';
import assert from 'node:assert/strict';

import { createNoteCleanupService } from '../src/modules/note-cleanup.js';

test('note cleanup service lists draft-like notes as cleanup candidates', async () => {
    const service = createNoteCleanupService({
        countCandidateNotes: async () => 1,
        countReminders: async () => 0,
        deleteNoteAndPruneTags: async () => undefined,
        findBackReferences: async () => [],
        findCandidateNotes: async () => [{
            id: 7,
            title: 'draft: old idea',
            content: 'temporary draft content',
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            pinned: false,
            tags: []
        }],
        findNote: async () => null,
        getTagNoteCounts: async () => new Map()
    });

    const result = await service.listCleanupCandidates({
        keywords: ['draft', 'temp'],
        limit: 20,
        offset: 0
    });

    assert.equal(result.totalCount, 1);
    assert.deepEqual(result.notes, [{
        id: '7',
        title: 'draft: old idea',
        updatedAt: '2026-01-01T00:00:00.000Z',
        pinned: false,
        tagNames: [],
        reminderCount: 0,
        backReferenceCount: 0,
        matchedTerms: ['draft', 'temp'],
        reasons: ['matched_terms:draft,temp', 'not_pinned', 'tagless', 'no_reminders', 'no_back_references'],
        requiresForce: false,
        forceReasons: []
    }]);
});

test('note cleanup preview exposes reminders, backlinks, and orphaned tags', async () => {
    const service = createNoteCleanupService({
        countCandidateNotes: async () => 0,
        countReminders: async () => 2,
        deleteNoteAndPruneTags: async () => undefined,
        findBackReferences: async () => [{
            id: 11,
            title: 'Backlink note'
        }],
        findCandidateNotes: async () => [],
        findNote: async () => ({
            id: 3,
            title: 'Pinned note',
            content: 'content',
            updatedAt: new Date('2026-03-01T00:00:00.000Z'),
            pinned: true,
            tags: [
                {
                    id: 1,
                    name: 'project'
                },
                {
                    id: 2,
                    name: 'temp'
                }
            ]
        }),
        getTagNoteCounts: async () => new Map([
            [1, 2],
            [2, 1]
        ])
    });

    const preview = await service.getDeletePreview(3);

    assert.deepEqual(preview, {
        id: '3',
        title: 'Pinned note',
        updatedAt: '2026-03-01T00:00:00.000Z',
        pinned: true,
        tagNames: ['project', 'temp'],
        reminderCount: 2,
        backReferences: [{
            id: '11',
            title: 'Backlink note'
        }],
        orphanedTagNames: ['temp'],
        requiresForce: true,
        forceReasons: ['note_is_pinned', 'has_reminders', 'has_back_references', 'orphan_tags']
    });
});

test('note cleanup delete removes the note and prunes orphan tags', async () => {
    const deleted: Array<{ noteId: number; orphanTagIds: number[] }> = [];
    const service = createNoteCleanupService({
        countCandidateNotes: async () => 0,
        countReminders: async () => 0,
        deleteNoteAndPruneTags: async (noteId, orphanTagIds) => {
            deleted.push({
                noteId,
                orphanTagIds
            });
        },
        findBackReferences: async () => [],
        findCandidateNotes: async () => [],
        findNote: async () => ({
            id: 9,
            title: 'Temp note',
            content: 'content',
            updatedAt: new Date('2026-03-10T00:00:00.000Z'),
            pinned: false,
            tags: [{
                id: 5,
                name: 'temp'
            }]
        }),
        getTagNoteCounts: async () => new Map([[5, 1]])
    });

    const deletedPreview = await service.deleteNoteById(9);

    assert.equal(deleted.length, 1);
    assert.deepEqual(deleted[0], {
        noteId: 9,
        orphanTagIds: [5]
    });
    assert.deepEqual(deletedPreview, {
        id: '9',
        title: 'Temp note',
        updatedAt: '2026-03-10T00:00:00.000Z',
        pinned: false,
        tagNames: ['temp'],
        reminderCount: 0,
        backReferences: [],
        orphanedTagNames: ['temp'],
        requiresForce: true,
        forceReasons: ['orphan_tags']
    });
});
