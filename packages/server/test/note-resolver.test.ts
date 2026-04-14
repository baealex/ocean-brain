import assert from 'node:assert/strict';
import test from 'node:test';

import { createAllNotesQueryResolver } from '../src/schema/note/index.js';

test('allNotes resolver uses stored searchable text with DB pagination when no stale notes exist', async () => {
    const findCalls: unknown[] = [];

    const resolver = createAllNotesQueryResolver({
        countNotes: async ({ where }) => {
            assert.deepEqual(where, {
                AND: [
                    { searchableTextVersion: 1 },
                    { searchableText: { contains: '123' } },
                    { NOT: { searchableText: { contains: 'draft' } } },
                ],
            });

            return 2;
        },
        triggerSearchBackfill: () => undefined,
        findNotes: async (args) => {
            findCalls.push(args);

            if (
                'where' in args &&
                args.where &&
                typeof args.where === 'object' &&
                'AND' in args.where &&
                Array.isArray(args.where.AND) &&
                args.where.AND.some(
                    (item) =>
                        typeof item === 'object' &&
                        item !== null &&
                        'searchableTextVersion' in item &&
                        typeof item.searchableTextVersion === 'object' &&
                        item.searchableTextVersion !== null &&
                        'not' in item.searchableTextVersion,
                )
            ) {
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

    assert.deepEqual(findCalls, [
        {
            orderBy: [{ updatedAt: 'desc' }],
            where: {
                AND: [
                    { searchableTextVersion: { not: 1 } },
                    {
                        OR: [{ title: { contains: '123' } }, { content: { contains: '123' } }],
                    },
                ],
            },
        },
        {
            orderBy: [{ updatedAt: 'desc' }],
            where: {
                AND: [
                    { searchableTextVersion: 1 },
                    { searchableText: { contains: '123' } },
                    { NOT: { searchableText: { contains: 'draft' } } },
                ],
            },
            take: 1,
            skip: 1,
        },
    ]);
    assert.equal(result.totalCount, 2);
    assert.deepEqual(
        result.notes.map((note) => note.id),
        [2],
    );
});

test('allNotes resolver merges stale fallback matches with stored-search matches', async () => {
    const resolver = createAllNotesQueryResolver({
        countNotes: async ({ where }) => {
            assert.deepEqual(where, {
                AND: [{ searchableTextVersion: 1 }, { searchableText: { contains: '123' } }],
            });

            return 1;
        },
        triggerSearchBackfill: () => undefined,
        findNotes: async (args) => {
            if (
                'where' in args &&
                args.where &&
                typeof args.where === 'object' &&
                'AND' in args.where &&
                Array.isArray(args.where.AND) &&
                args.where.AND.some(
                    (item) =>
                        typeof item === 'object' &&
                        item !== null &&
                        'searchableTextVersion' in item &&
                        typeof item.searchableTextVersion === 'object' &&
                        item.searchableTextVersion !== null &&
                        'not' in item.searchableTextVersion,
                )
            ) {
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
