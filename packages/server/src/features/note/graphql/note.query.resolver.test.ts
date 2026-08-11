import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildNotesInDateRangeWhere,
    createAllNotesQueryResolver,
    createBackReferencesQueryResolver,
    createNoteGraphQueryResolver,
    createNoteQueryResolver,
} from './note.query.resolver.js';

test('notes in date range uses an exclusive end boundary for both note dates', () => {
    const start = '2026-08-01T00:00:00.000Z';
    const end = '2026-09-01T00:00:00.000Z';

    assert.deepEqual(buildNotesInDateRangeWhere({ start, end }), {
        OR: [
            { updatedAt: { gte: new Date(start), lt: new Date(end) } },
            { createdAt: { gte: new Date(start), lt: new Date(end) } },
        ],
    });
});

const createNoteRecord = (input: { id: number; title: string; content: string; updatedAt?: Date }) =>
    ({
        id: input.id,
        title: input.title,
        content: input.content,
        searchableText: '',
        searchableTextVersion: 0,
        createdAt: new Date('2026-06-04T00:00:00.000Z'),
        updatedAt: input.updatedAt ?? new Date('2026-06-04T00:00:00.000Z'),
        pinned: false,
        order: 0,
        layout: 'wide',
    }) as const;

test('allNotes resolver uses stored searchable text with DB pagination when no stale notes exist', async () => {
    const findCalls: unknown[] = [];
    let triggerSearchBackfillCount = 0;

    const resolver = createAllNotesQueryResolver({
        countNotes: async () => 2,
        triggerSearchBackfill: () => {
            triggerSearchBackfillCount += 1;
        },
        findNotes: async (args) => {
            findCalls.push(args);

            if (findCalls.length === 1) {
                return [] as never;
            }

            return [
                {
                    id: 2,
                    title: 'Another match',
                    content: JSON.stringify([]),
                    searchableText: 'another match contains 123 here',
                    searchableTextVersion: 1,
                    createdAt: new Date('2026-04-01T00:00:00.000Z'),
                    updatedAt: new Date('2026-04-02T00:00:00.000Z'),
                    pinned: false,
                    order: 0,
                    layout: 'wide',
                },
            ] as never;
        },
    });

    const result = await resolver(null, {
        searchFilter: {
            query: '123 -draft',
        },
        pagination: {
            limit: 1,
            offset: 1,
        },
    });

    assert.equal(findCalls.length, 2);
    assert.deepEqual((findCalls[1] as { orderBy?: unknown }).orderBy, [{ updatedAt: 'desc' }]);
    assert.equal((findCalls[1] as { take?: unknown }).take, 1);
    assert.equal((findCalls[1] as { skip?: unknown }).skip, 1);
    assert.equal(triggerSearchBackfillCount, 0);
    assert.equal(result.totalCount, 2);
    assert.deepEqual(
        result.notes.map((note) => note.id),
        [2],
    );
});

test('allNotes resolver merges stale fallback matches with stored-search matches', async () => {
    const findCalls: unknown[] = [];
    let triggerSearchBackfillCount = 0;

    const resolver = createAllNotesQueryResolver({
        countNotes: async () => 1,
        triggerSearchBackfill: () => {
            triggerSearchBackfillCount += 1;
        },
        findNotes: async (args) => {
            findCalls.push(args);

            if (findCalls.length === 1) {
                return [
                    {
                        id: 1,
                        title: 'Legacy stale note',
                        content: JSON.stringify([
                            {
                                id: 'paragraph-1',
                                type: 'paragraph',
                                props: {},
                                content: [
                                    {
                                        type: 'text',
                                        text: 'Contains 123 here',
                                        styles: {},
                                    },
                                ],
                                children: [],
                            },
                        ]),
                        searchableText: '',
                        searchableTextVersion: 0,
                        createdAt: new Date('2026-04-01T00:00:00.000Z'),
                        updatedAt: new Date('2026-04-03T00:00:00.000Z'),
                        pinned: false,
                        order: 0,
                        layout: 'wide',
                    },
                ] as never;
            }

            return [
                {
                    id: 2,
                    title: 'Fresh note',
                    content: JSON.stringify([]),
                    searchableText: 'fresh note task 123',
                    searchableTextVersion: 1,
                    createdAt: new Date('2026-04-01T00:00:00.000Z'),
                    updatedAt: new Date('2026-04-02T00:00:00.000Z'),
                    pinned: false,
                    order: 0,
                    layout: 'wide',
                },
            ] as never;
        },
    });

    const result = await resolver(null, {
        searchFilter: {
            query: '123',
        },
        pagination: {
            limit: 2,
            offset: 0,
        },
    });

    assert.equal(result.totalCount, 2);
    assert.equal(findCalls.length, 2);
    assert.equal(triggerSearchBackfillCount, 1);
    assert.deepEqual(
        result.notes.map((note) => note.id),
        [1, 2],
    );
});

test('allNotes resolver leaves unfiltered queries on the fast default path', async () => {
    let countedWhere: unknown;
    let foundArgs: unknown;

    const resolver = createAllNotesQueryResolver({
        countNotes: async ({ where }) => {
            countedWhere = where;
            return 3;
        },
        triggerSearchBackfill: () => undefined,
        findNotes: async (args) => {
            foundArgs = args;
            return [] as never;
        },
    });

    const result = await resolver(null, {
        searchFilter: {
            query: '',
        },
        pagination: {
            limit: 20,
            offset: 40,
        },
    });

    assert.equal(countedWhere, undefined);
    assert.deepEqual(foundArgs, {
        orderBy: [{ updatedAt: 'desc' }],
        take: 20,
        skip: 40,
    });
    assert.equal(result.totalCount, 3);
    assert.deepEqual(result.notes, []);
});

test('note resolver lazily repairs structured reference titles after target note rename', async () => {
    const sourceUpdatedAt = new Date('2026-06-04T00:00:00.000Z');
    const sourceContent = JSON.stringify([
        {
            id: 'paragraph-1',
            type: 'paragraph',
            props: {},
            content: [
                { type: 'text', text: 'See ', styles: {} },
                {
                    type: 'reference',
                    props: {
                        id: '2',
                        title: 'Old target title',
                    },
                },
            ],
            children: [],
        },
    ]);
    const updates: unknown[] = [];

    const resolver = createNoteQueryResolver({
        findNote: async (id) =>
            createNoteRecord({ id, title: 'Source note', content: sourceContent, updatedAt: sourceUpdatedAt }) as never,
        findReferenceNotes: async (ids) => {
            assert.deepEqual(ids, [2]);
            return [createNoteRecord({ id: 2, title: 'Renamed target title', content: '[]' })] as never;
        },
        updateNoteContent: async (input) => {
            updates.push(input);
            return createNoteRecord({
                id: input.id,
                title: 'Source note',
                content: input.content,
                updatedAt: new Date('2026-06-04T00:00:01.000Z'),
            }) as never;
        },
        isRecordNotFoundError: () => false,
    });

    const result = await resolver(null, { id: '1' });

    assert.equal(JSON.parse(result.content)[0].content[1].props.title, 'Renamed target title');
    assert.deepEqual(updates, [
        {
            id: 1,
            updatedAt: sourceUpdatedAt,
            content: result.content,
            searchableText: 'source note see renamed target title',
            searchableTextVersion: 1,
        },
    ]);
});

test('note resolver cannot repair unresolved plain-text wiki links after target note rename', async () => {
    const sourceContent = JSON.stringify([
        {
            id: 'paragraph-1',
            type: 'paragraph',
            props: {},
            content: [{ type: 'text', text: 'See [[Old target title]]', styles: {} }],
            children: [],
        },
    ]);
    let didFindReferences = false;
    let didUpdate = false;

    const resolver = createNoteQueryResolver({
        findNote: async (id) => createNoteRecord({ id, title: 'Source note', content: sourceContent }) as never,
        findReferenceNotes: async () => {
            didFindReferences = true;
            return [];
        },
        updateNoteContent: async () => {
            didUpdate = true;
            throw new Error('should not update unresolved plain text links');
        },
        isRecordNotFoundError: () => false,
    });

    const result = await resolver(null, { id: '1' });

    assert.equal(result.content, sourceContent);
    assert.equal(didFindReferences, false);
    assert.equal(didUpdate, false);
});

test('backReferences resolver finds structurally valid references in formatted note JSON', async () => {
    const resolver = createBackReferencesQueryResolver({
        findCandidateNotes: async (noteId) => {
            assert.equal(noteId, 7);

            return [
                {
                    id: 8,
                    title: 'Source note',
                    content: JSON.stringify(
                        [
                            {
                                id: 'paragraph-1',
                                type: 'paragraph',
                                props: {},
                                content: [
                                    {
                                        type: 'reference',
                                        props: {
                                            id: '7',
                                            title: 'Target note',
                                        },
                                    },
                                ],
                                children: [],
                            },
                        ],
                        null,
                        2,
                    ),
                    searchableText: '',
                    searchableTextVersion: 1,
                    createdAt: new Date('2026-04-01T00:00:00.000Z'),
                    updatedAt: new Date('2026-04-02T00:00:00.000Z'),
                    pinned: false,
                    order: 0,
                    layout: 'wide',
                },
                {
                    id: 9,
                    title: 'Non-reference note',
                    content: JSON.stringify([
                        {
                            id: 'paragraph-1',
                            type: 'paragraph',
                            props: {},
                            content: [
                                {
                                    type: 'text',
                                    text: 'The word reference alone is not a link.',
                                    styles: {},
                                },
                            ],
                            children: [],
                        },
                    ]),
                    searchableText: '',
                    searchableTextVersion: 1,
                    createdAt: new Date('2026-04-01T00:00:00.000Z'),
                    updatedAt: new Date('2026-04-03T00:00:00.000Z'),
                    pinned: false,
                    order: 0,
                    layout: 'wide',
                },
            ] as never;
        },
    });

    const result = await resolver(null, { id: '7' });

    assert.deepEqual(
        result.map((note) => note.id),
        [8],
    );
});

test('noteGraph resolver reads note metadata and links from the reference index', async () => {
    const updatedAt = new Date('2026-08-02T12:00:00.000Z');
    const noteQueries: unknown[] = [];
    const referenceQueries: unknown[] = [];
    const resolver = createNoteGraphQueryResolver({
        findNotes: async (args) => {
            noteQueries.push(args);

            return [
                { id: 1, title: 'Source', updatedAt, tags: [{ id: 10, name: '@product' }] },
                { id: 2, title: 'Target', updatedAt, tags: [] },
            ];
        },
        findReferences: async (args) => {
            referenceQueries.push(args);

            return [{ sourceNoteId: 1, targetNoteId: 2 }];
        },
    });

    await resolver();

    assert.deepEqual(noteQueries, [
        {
            orderBy: [{ id: 'asc' }],
            select: {
                id: true,
                title: true,
                updatedAt: true,
                tags: {
                    orderBy: [{ name: 'asc' }],
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        },
    ]);
    assert.deepEqual(referenceQueries, [
        {
            orderBy: [{ sourceNoteId: 'asc' }, { targetNoteId: 'asc' }],
            select: {
                sourceNoteId: true,
                targetNoteId: true,
            },
        },
    ]);
});

test('noteGraph resolver preserves the graph response contract with indexed references', async () => {
    const updatedAt = new Date('2026-08-02T12:00:00.000Z');
    const resolver = createNoteGraphQueryResolver({
        findNotes: async () => [
            {
                id: 1,
                title: 'Source',
                updatedAt,
                tags: [{ id: 10, name: '@product' }],
            },
            {
                id: 2,
                title: 'Target',
                updatedAt,
                tags: [],
            },
        ],
        findReferences: async () => [{ sourceNoteId: 1, targetNoteId: 2 }],
    });

    assert.deepEqual(await resolver(), {
        nodes: [
            {
                id: '1',
                title: 'Source',
                connections: 1,
                updatedAt: String(updatedAt.getTime()),
                tags: [{ id: '10', name: '@product' }],
            },
            { id: '2', title: 'Target', connections: 1, updatedAt: String(updatedAt.getTime()), tags: [] },
        ],
        links: [{ source: '1', target: '2' }],
    });
});
