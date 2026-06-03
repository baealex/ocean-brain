import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import models from '~/models.js';
import {
    buildPropertyFilterWhere,
    buildViewSectionWhere,
    clampViewSectionLimit,
    getNotesByProperties,
    hydratePropertyFilters,
    normalizeViewDisplayOptions,
    normalizeViewNotesPagination,
    normalizeViewNotesQueryInput,
    normalizeViewPropertyFilters,
    normalizeViewSectionInput,
    normalizeViewTabTitle,
    normalizeViewTagNames,
    pickNextActiveViewTabId,
    type ViewPropertyFilterRecord,
    type ViewSectionRecord,
} from './workspace.js';

test('normalizeViewTagNames trims values and canonicalizes plain or hash-prefixed tags', () => {
    assert.deepEqual(normalizeViewTagNames([' project ', '#doing', '@todo', '', '@todo']), [
        '@project',
        '@doing',
        '@todo',
    ]);
});

test('normalizeViewSectionInput derives a default title and clamps invalid limits', () => {
    assert.deepEqual(
        normalizeViewSectionInput({
            title: '   ',
            tagNames: ['project', '#review'],
            mode: 'or',
            limit: 999,
        }),
        {
            title: '@project + @review',
            displayType: 'list',
            displayOptions: {
                tableColumns: ['title', 'tags', 'properties', 'createdAt', 'updatedAt'],
            },
            tagNames: ['@project', '@review'],
            mode: 'or',
            propertyFilters: [],
            sortBy: 'updatedAt',
            sortOrder: 'desc',
            limit: 20,
        },
    );
});

test('normalizeViewSectionInput allows all-note views without filters', () => {
    assert.deepEqual(
        normalizeViewSectionInput({
            title: '',
            tagNames: ['   ', ''],
        }),
        {
            title: 'All notes',
            displayType: 'list',
            displayOptions: {
                tableColumns: ['title', 'tags', 'properties', 'createdAt', 'updatedAt'],
            },
            tagNames: [],
            mode: 'and',
            propertyFilters: [],
            sortBy: 'updatedAt',
            sortOrder: 'desc',
            limit: 5,
        },
    );
});

test('normalizeViewSectionInput preserves table display sections', () => {
    assert.equal(
        normalizeViewSectionInput({
            title: 'Project tasks',
            displayType: 'table',
            displayOptions: {
                tableColumns: ['title', 'properties', 'updatedAt'],
            },
            tagNames: [],
        }).displayType,
        'table',
    );
});

test('normalizeViewDisplayOptions keeps table title visible and drops duplicates', () => {
    assert.deepEqual(normalizeViewDisplayOptions({ tableColumns: ['tags', 'tags', 'updatedAt'] }), {
        tableColumns: ['title', 'tags', 'updatedAt'],
    });
});

test('normalizeViewPropertyFilters validates typed filter values', () => {
    assert.deepEqual(
        normalizeViewPropertyFilters([{ key: ' State ', valueType: 'select', operator: 'equals', value: 'todo' }]),
        [
            {
                key: 'state',
                name: 'state',
                valueType: 'select',
                operator: 'equals',
                value: 'todo',
            },
        ],
    );

    assert.throws(() =>
        normalizeViewPropertyFilters([{ key: 'due', valueType: 'date', operator: 'equals', value: '2026-99-99' }]),
    );

    assert.deepEqual(
        normalizeViewPropertyFilters([
            { key: 'source', valueType: 'url', operator: 'equals', value: 'https://example.com/docs' },
        ]),
        [
            {
                key: 'source',
                name: 'source',
                valueType: 'url',
                operator: 'equals',
                value: 'https://example.com/docs',
            },
        ],
    );

    assert.throws(() =>
        normalizeViewPropertyFilters([{ key: 'source', valueType: 'url', operator: 'equals', value: 'not-a-url' }]),
    );

    assert.deepEqual(
        normalizeViewPropertyFilters([{ key: 'source', valueType: 'url', operator: 'contains', value: 'example.com' }]),
        [
            {
                key: 'source',
                name: 'source',
                valueType: 'url',
                operator: 'contains',
                value: 'example.com',
            },
        ],
    );

    assert.throws(() =>
        normalizeViewPropertyFilters([{ key: 'priority', valueType: 'number', operator: 'contains', value: '1' }]),
    );
});

test('normalizeViewNotesQueryInput normalizes property query filters without section-only fields', () => {
    assert.deepEqual(
        normalizeViewNotesQueryInput({
            tagNames: ['project', '#doing'],
            mode: 'or',
            propertyFilters: [{ key: ' State ', valueType: 'select', operator: 'equals', value: 'doing' }],
            sortBy: 'title',
            sortOrder: 'asc',
        }),
        {
            tagNames: ['@project', '@doing'],
            mode: 'or',
            propertyFilters: [
                {
                    key: 'state',
                    name: 'state',
                    valueType: 'select',
                    operator: 'equals',
                    value: 'doing',
                },
            ],
            sortBy: 'title',
            sortOrder: 'asc',
        },
    );
});

test('normalizeViewNotesPagination clamps property query pagination', () => {
    assert.deepEqual(normalizeViewNotesPagination({ limit: 999, offset: -5 }), { limit: 50, offset: 0 });
    assert.deepEqual(normalizeViewNotesPagination({ limit: 0, offset: 7 }), { limit: 1, offset: 7 });
    assert.deepEqual(normalizeViewNotesPagination({ limit: Number.NaN, offset: Number.NaN }), { limit: 20, offset: 0 });
});

test('buildPropertyFilterWhere maps property filters to note relation filters', () => {
    assert.deepEqual(
        buildPropertyFilterWhere({
            key: 'state',
            name: 'State',
            valueType: 'select',
            operator: 'equals',
            value: 'Todo',
        }),
        {
            properties: {
                some: {
                    definition: {
                        is: {
                            key: 'state',
                        },
                    },
                    option: {
                        is: {
                            value: 'todo',
                        },
                    },
                },
            },
        },
    );
});

test('buildPropertyFilterWhere maps existence operators', () => {
    const baseFilter: ViewPropertyFilterRecord = {
        key: 'state',
        name: 'State',
        valueType: 'select',
        operator: 'exists',
        value: null,
    };

    assert.deepEqual(buildPropertyFilterWhere(baseFilter), {
        properties: {
            some: {
                definition: {
                    is: {
                        key: 'state',
                    },
                },
            },
        },
    });

    assert.deepEqual(buildPropertyFilterWhere({ ...baseFilter, operator: 'notExists' }), {
        properties: {
            none: {
                definition: {
                    is: {
                        key: 'state',
                    },
                },
            },
        },
    });
});

test('buildPropertyFilterWhere maps number and date range operators', () => {
    assert.deepEqual(
        buildPropertyFilterWhere({
            key: 'priority',
            name: 'Priority',
            valueType: 'number',
            operator: 'before',
            value: '3',
        }),
        {
            properties: {
                some: {
                    definition: {
                        is: {
                            key: 'priority',
                        },
                    },
                    numberValue: {
                        lt: 3,
                    },
                },
            },
        },
    );

    assert.deepEqual(
        buildPropertyFilterWhere({
            key: 'due',
            name: 'Due',
            valueType: 'date',
            operator: 'after',
            value: '2026-05-31',
        }),
        {
            properties: {
                some: {
                    definition: {
                        is: {
                            key: 'due',
                        },
                    },
                    dateValue: {
                        gt: new Date('2026-05-31T00:00:00.000Z'),
                    },
                },
            },
        },
    );
});

test('buildPropertyFilterWhere maps URL filters through normalized text storage', () => {
    assert.deepEqual(
        buildPropertyFilterWhere({
            key: 'source',
            name: 'Source',
            valueType: 'url',
            operator: 'equals',
            value: 'https://example.com/docs',
        }),
        {
            properties: {
                some: {
                    definition: {
                        is: {
                            key: 'source',
                        },
                    },
                    textValueNormalized: 'https://example.com/docs',
                },
            },
        },
    );
});

test('buildPropertyFilterWhere maps negative and contains operators while requiring the property to exist', () => {
    assert.deepEqual(
        buildPropertyFilterWhere({
            key: 'state',
            name: 'State',
            valueType: 'select',
            operator: 'notEquals',
            value: 'Done',
        }),
        {
            properties: {
                some: {
                    definition: {
                        is: {
                            key: 'state',
                        },
                    },
                    option: {
                        is: {
                            value: {
                                not: 'done',
                            },
                        },
                    },
                },
            },
        },
    );

    assert.deepEqual(
        buildPropertyFilterWhere({
            key: 'summary',
            name: 'Summary',
            valueType: 'text',
            operator: 'contains',
            value: 'Brain',
        }),
        {
            properties: {
                some: {
                    definition: {
                        is: {
                            key: 'summary',
                        },
                    },
                    textValueNormalized: {
                        contains: 'brain',
                    },
                },
            },
        },
    );

    assert.deepEqual(
        buildPropertyFilterWhere({
            key: 'summary',
            name: 'Summary',
            valueType: 'text',
            operator: 'notContains',
            value: 'Brain',
        }),
        {
            properties: {
                some: {
                    definition: {
                        is: {
                            key: 'summary',
                        },
                    },
                    textValueNormalized: {
                        not: {
                            contains: 'brain',
                        },
                    },
                },
            },
        },
    );
});

test('getNotesByProperties excludes notes missing the property for negative filters', async () => {
    const suffix = randomUUID().slice(0, 8);
    const stateKey = `state-${suffix}`;
    const summaryKey = `summary-${suffix}`;
    const noteIds: number[] = [];
    const propertyDefinitionIds: number[] = [];

    try {
        const stateDefinition = await models.propertyDefinition.create({
            data: {
                key: stateKey,
                name: `State ${suffix}`,
                valueType: 'select',
                options: {
                    create: [
                        { label: 'Done', value: 'done', order: 0 },
                        { label: 'Doing', value: 'doing', order: 1 },
                    ],
                },
            },
            include: {
                options: true,
            },
        });
        const summaryDefinition = await models.propertyDefinition.create({
            data: {
                key: summaryKey,
                name: `Summary ${suffix}`,
                valueType: 'text',
            },
        });
        propertyDefinitionIds.push(stateDefinition.id, summaryDefinition.id);

        const doneOption = stateDefinition.options.find((option) => option.value === 'done');
        const doingOption = stateDefinition.options.find((option) => option.value === 'doing');

        assert.ok(doneOption);
        assert.ok(doingOption);

        const doneNote = await models.note.create({
            data: {
                title: `Done ${suffix}`,
                content: '',
                properties: {
                    create: [
                        {
                            propertyDefinitionId: stateDefinition.id,
                            optionId: doneOption.id,
                        },
                        {
                            propertyDefinitionId: summaryDefinition.id,
                            textValue: 'Brainstorm note',
                            textValueNormalized: 'brainstorm note',
                        },
                    ],
                },
            },
        });
        const doingNote = await models.note.create({
            data: {
                title: `Doing ${suffix}`,
                content: '',
                properties: {
                    create: [
                        {
                            propertyDefinitionId: stateDefinition.id,
                            optionId: doingOption.id,
                        },
                        {
                            propertyDefinitionId: summaryDefinition.id,
                            textValue: 'Plain note',
                            textValueNormalized: 'plain note',
                        },
                    ],
                },
            },
        });
        const missingPropertiesNote = await models.note.create({
            data: {
                title: `Missing properties ${suffix}`,
                content: '',
            },
        });
        noteIds.push(doneNote.id, doingNote.id, missingPropertiesNote.id);

        const notDoneResult = await getNotesByProperties(
            {
                propertyFilters: [
                    {
                        key: stateKey,
                        valueType: 'select',
                        operator: 'notEquals',
                        value: 'done',
                    },
                ],
                sortBy: 'title',
                sortOrder: 'asc',
            },
            { limit: 20, offset: 0 },
        );
        const notBrainResult = await getNotesByProperties(
            {
                propertyFilters: [
                    {
                        key: summaryKey,
                        valueType: 'text',
                        operator: 'notContains',
                        value: 'brain',
                    },
                ],
                sortBy: 'title',
                sortOrder: 'asc',
            },
            { limit: 20, offset: 0 },
        );

        assert.deepEqual(
            notDoneResult.notes.map((note) => note.id),
            [doingNote.id],
        );
        assert.deepEqual(
            notBrainResult.notes.map((note) => note.id),
            [doingNote.id],
        );
    } finally {
        if (noteIds.length > 0) {
            await models.note.deleteMany({ where: { id: { in: noteIds } } });
        }

        if (propertyDefinitionIds.length > 0) {
            await models.propertyDefinition.deleteMany({ where: { id: { in: propertyDefinitionIds } } });
        }
    }
});

test('hydratePropertyFilters validates property definitions and select options', async () => {
    const db = {
        propertyDefinition: {
            findMany: async () => [
                {
                    key: 'state',
                    name: 'State',
                    valueType: 'select',
                    options: [{ value: 'doing' }],
                },
                {
                    key: 'priority',
                    name: 'Priority',
                    valueType: 'number',
                    options: [],
                },
            ],
        },
    } as never;

    assert.deepEqual(
        await hydratePropertyFilters(
            db,
            [
                {
                    key: 'state',
                    name: 'state',
                    valueType: 'select',
                    operator: 'equals',
                    value: 'Doing',
                },
            ],
            { validateSelectOptions: true },
        ),
        [
            {
                key: 'state',
                name: 'State',
                valueType: 'select',
                operator: 'equals',
                value: 'Doing',
            },
        ],
    );

    await assert.rejects(
        () =>
            hydratePropertyFilters(
                db,
                [
                    {
                        key: 'state',
                        name: 'state',
                        valueType: 'select',
                        operator: 'equals',
                        value: 'blocked',
                    },
                ],
                { validateSelectOptions: true },
            ),
        /Property state option blocked is not defined/,
    );

    await assert.rejects(
        () =>
            hydratePropertyFilters(
                db,
                [
                    {
                        key: 'missing',
                        name: 'missing',
                        valueType: 'text',
                        operator: 'notExists',
                        value: null,
                    },
                ],
                { validateSelectOptions: true },
            ),
        /Property missing is not defined/,
    );

    await assert.rejects(
        () =>
            hydratePropertyFilters(
                db,
                [
                    {
                        key: 'priority',
                        name: 'priority',
                        valueType: 'text',
                        operator: 'equals',
                        value: '1',
                    },
                ],
                { validateSelectOptions: true },
            ),
        /Property priority uses number values/,
    );
});

const createSectionRecord = (patch: Partial<ViewSectionRecord> = {}): ViewSectionRecord => ({
    id: '1',
    tabId: '1',
    title: 'Doing',
    displayType: 'list',
    displayOptions: {
        tableColumns: ['title', 'tags', 'properties', 'createdAt', 'updatedAt'],
    },
    tagNames: [],
    mode: 'and',
    propertyFilters: [],
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    limit: 5,
    order: 0,
    ...patch,
});

test('buildViewSectionWhere returns an open query for all-note views', () => {
    assert.deepEqual(buildViewSectionWhere(createSectionRecord()), {});
});

test('buildViewSectionWhere combines tag and property filters with AND', () => {
    assert.deepEqual(
        buildViewSectionWhere(
            createSectionRecord({
                tagNames: ['@ocean', '@ai'],
                mode: 'or',
                propertyFilters: [
                    {
                        key: 'state',
                        name: 'State',
                        valueType: 'select',
                        operator: 'equals',
                        value: 'doing',
                    },
                ],
            }),
        ),
        {
            AND: [
                {
                    tags: {
                        some: {
                            name: {
                                in: ['@ocean', '@ai'],
                            },
                        },
                    },
                },
                {
                    properties: {
                        some: {
                            definition: {
                                is: {
                                    key: 'state',
                                },
                            },
                            option: {
                                is: {
                                    value: 'doing',
                                },
                            },
                        },
                    },
                },
            ],
        },
    );
});

test('normalizeViewTabTitle falls back to an untitled label', () => {
    assert.equal(normalizeViewTabTitle('   '), 'Untitled View');
    assert.equal(normalizeViewTabTitle(' Agent '), 'Agent');
});

test('clampViewSectionLimit keeps values inside the allowed range', () => {
    assert.equal(clampViewSectionLimit(undefined), 5);
    assert.equal(clampViewSectionLimit(0), 1);
    assert.equal(clampViewSectionLimit(8), 8);
    assert.equal(clampViewSectionLimit(99), 20);
});

test('pickNextActiveViewTabId falls back to the first remaining tab after deletion', () => {
    assert.equal(pickNextActiveViewTabId([3, 7, 9], 7, 7), 3);
    assert.equal(pickNextActiveViewTabId([3, 7, 9], 7, 3), 3);
    assert.equal(pickNextActiveViewTabId([7], 7, 7), null);
});
