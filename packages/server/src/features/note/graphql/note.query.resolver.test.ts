import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createAllNotesQueryResolver,
    createBackReferencesQueryResolver,
    createNoteGraphQueryResolver,
    createNoteQueryResolver,
} from './note.query.resolver.js';

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

test('noteGraph resolver uses the shared structural reference parser', async () => {
    const resolver = createNoteGraphQueryResolver({
        findNotes: async () => [
            {
                id: 1,
                title: 'Source',
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
                                        id: '2',
                                        title: 'Target',
                                    },
                                },
                            ],
                            children: [],
                        },
                    ],
                    null,
                    2,
                ),
            },
            {
                id: 2,
                title: 'Target',
                content: JSON.stringify([]),
            },
        ],
    });

    assert.deepEqual(await resolver(), {
        nodes: [
            { id: '1', title: 'Source', connections: 1 },
            { id: '2', title: 'Target', connections: 1 },
        ],
        links: [{ source: '1', target: '2' }],
    });
});
