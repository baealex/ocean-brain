import assert from 'node:assert/strict';
import test from 'node:test';

import { createNoteSearchBackfillService } from './search-backfill.js';

test('note search backfill updates stale notes in batches until complete', async () => {
    const listedLimits: number[] = [];
    const updatedBatches: Array<Array<{ id: number; searchableText: string; searchableTextVersion: number }>> = [];
    const batches = [
        [
            {
                id: 1,
                title: 'Roadmap',
                content: JSON.stringify([
                    {
                        id: 'paragraph-1',
                        type: 'paragraph',
                        props: {},
                        content: [
                            {
                                type: 'text',
                                text: 'Sprint 42',
                                styles: {},
                            },
                        ],
                        children: [],
                    },
                ]),
            },
            {
                id: 2,
                title: 'Release',
                content: JSON.stringify([
                    {
                        id: 'paragraph-2',
                        type: 'paragraph',
                        props: {},
                        content: [
                            {
                                type: 'text',
                                text: 'Candidate',
                                styles: {},
                            },
                        ],
                        children: [],
                    },
                ]),
            },
        ],
        [
            {
                id: 3,
                title: 'Archive',
                content: JSON.stringify([]),
            },
        ],
        [],
    ];

    const service = createNoteSearchBackfillService({
        listStaleNotes: async (limit) => {
            listedLimits.push(limit);
            return batches.shift() ?? [];
        },
        updateNotes: async (updates) => {
            updatedBatches.push(
                updates.map(({ id, projection }) => ({
                    id,
                    searchableText: projection.searchableText,
                    searchableTextVersion: projection.searchableTextVersion,
                })),
            );
        },
    });

    const backfilled = await service.backfillAll(2);

    assert.equal(backfilled, 3);
    assert.deepEqual(listedLimits, [2, 2]);
    assert.deepEqual(updatedBatches, [
        [
            {
                id: 1,
                searchableText: 'roadmap sprint 42',
                searchableTextVersion: 1,
            },
            {
                id: 2,
                searchableText: 'release candidate',
                searchableTextVersion: 1,
            },
        ],
        [
            {
                id: 3,
                searchableText: 'archive',
                searchableTextVersion: 1,
            },
        ],
    ]);
});

test('note search backfill stops cleanly when nothing is stale', async () => {
    const service = createNoteSearchBackfillService({
        listStaleNotes: async () => [],
        updateNotes: async () => {
            throw new Error('should not update when there is nothing to backfill');
        },
    });

    const backfilled = await service.backfillAll(50);

    assert.equal(backfilled, 0);
});
