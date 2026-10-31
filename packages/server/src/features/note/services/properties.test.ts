import assert from 'node:assert/strict';
import test from 'node:test';

import {
    assertPropertyOptionUpdateKeepsUsedValues,
    createNotePropertyDefinition,
    findReferencedRemovedPropertyOptionValue,
    InvalidNotePropertyInputError,
    normalizePropertyKey,
    normalizeUrlValue,
    renamePropertyFiltersInViewQuery,
    resolveNotePropertiesPatchValueTypes,
    updateNotePropertiesWithVersionGuard,
    viewQueryReferencesProperty,
} from './properties.js';
import { MissingNoteVersionError } from './write-conflict.js';

test('normalizePropertyKey normalizes user input into a stable query key', () => {
    assert.equal(normalizePropertyKey(' Project State '), 'project-state');
    assert.equal(normalizePropertyKey('project_state'), 'project_state');
});

test('normalizePropertyKey rejects empty or unsupported keys', () => {
    assert.throws(() => normalizePropertyKey('   '), InvalidNotePropertyInputError);
    assert.throws(() => normalizePropertyKey('#state'), InvalidNotePropertyInputError);
});

test('normalizeUrlValue accepts only http(s) URLs', () => {
    assert.equal(normalizeUrlValue(' https://example.com/docs '), 'https://example.com/docs');
    assert.throws(() => normalizeUrlValue('example.com'), InvalidNotePropertyInputError);
    assert.throws(() => normalizeUrlValue('javascript:alert(1)'), InvalidNotePropertyInputError);
});

test('resolveNotePropertiesPatchValueTypes fills value types from shared definitions', async () => {
    const patch = await resolveNotePropertiesPatchValueTypes(
        {
            set: [{ key: ' State ', value: 'todo' }],
            deleteKeys: [' Project '],
        },
        {
            propertyDefinition: {
                findMany: async () => [
                    {
                        key: 'state',
                        name: 'State',
                        valueType: 'select' as const,
                    },
                ],
            },
        } as never,
    );

    assert.deepEqual(patch, {
        set: [{ key: 'state', name: 'State', value: 'todo', valueType: 'select' }],
        deleteKeys: ['project'],
    });
});

test('resolveNotePropertiesPatchValueTypes rejects unknown property keys', async () => {
    await assert.rejects(
        () =>
            resolveNotePropertiesPatchValueTypes(
                {
                    set: [{ key: 'state', value: 'todo' }],
                },
                {
                    propertyDefinition: {
                        findMany: async () => [],
                    },
                } as never,
            ),
        (error: unknown) =>
            error instanceof InvalidNotePropertyInputError &&
            error.message === 'Property state is not defined. Create it in property settings first.',
    );
});

test('property definitions require valid select option datasets before write', async () => {
    await assert.rejects(
        () =>
            createNotePropertyDefinition({
                key: 'state',
                name: 'State',
                valueType: 'select',
                options: [],
            }),
        (error: unknown) =>
            error instanceof InvalidNotePropertyInputError &&
            error.message === 'Select properties require at least one option.',
    );

    await assert.rejects(
        () =>
            createNotePropertyDefinition({
                key: 'state',
                name: 'State',
                valueType: 'select',
                options: [{ label: 'Todo' }, { label: 'Todo' }],
            }),
        (error: unknown) =>
            error instanceof InvalidNotePropertyInputError &&
            error.message === 'Property options contain duplicate values.',
    );

    await assert.rejects(
        () =>
            createNotePropertyDefinition({
                key: 'memo',
                name: 'Memo',
                valueType: 'text',
                options: [{ label: 'Todo' }],
            }),
        (error: unknown) =>
            error instanceof InvalidNotePropertyInputError &&
            error.message === 'Only select properties can have options.',
    );
});

test('a property definition update may drop an option that no note uses', () => {
    assert.doesNotThrow(() =>
        assertPropertyOptionUpdateKeepsUsedValues({
            existingOptions: [
                { id: 1, value: 'todo', _count: { properties: 0 } },
                { id: 2, value: 'doing', _count: { properties: 2 } },
            ],
            nextOptions: [{ id: 2 }],
        }),
    );
});

test('a property definition update cannot drop an option that notes use', () => {
    assert.throws(
        () =>
            assertPropertyOptionUpdateKeepsUsedValues({
                existingOptions: [{ id: 2, value: 'doing', _count: { properties: 2 } }],
                nextOptions: [{}],
            }),
        InvalidNotePropertyInputError,
    );
});

test('property option updates keep values referenced by saved views', () => {
    const query = JSON.stringify({
        propertyFilters: [
            {
                key: 'state',
                name: 'State',
                valueType: 'select',
                operator: 'equals',
                value: 'doing',
            },
        ],
        sortBy: 'updatedAt',
        sortOrder: 'desc',
    });

    assert.equal(
        findReferencedRemovedPropertyOptionValue({
            query,
            key: 'state',
            removedValues: new Set(['doing']),
        }),
        'doing',
    );

    assert.equal(
        findReferencedRemovedPropertyOptionValue({
            query,
            key: 'state',
            removedValues: new Set(['done']),
        }),
        null,
    );
});

test('property definition deletion detects references from saved views', () => {
    const query = JSON.stringify({
        propertyFilters: [
            {
                key: 'state',
                name: 'State',
                valueType: 'select',
                operator: 'equals',
                value: 'doing',
            },
        ],
    });

    assert.equal(viewQueryReferencesProperty({ query, key: 'state', displayType: 'list' }), true);
    assert.equal(viewQueryReferencesProperty({ query, key: 'project', displayType: 'list' }), false);
    assert.equal(viewQueryReferencesProperty({ query: '{invalid', key: 'state', displayType: 'list' }), false);
});

test('property definition deletion detects references from saved view display options', () => {
    const query = JSON.stringify({
        propertyFilters: [],
        displayOptions: {
            tablePropertyKeys: ['owner'],
            boardGroupByPropertyKey: 'state',
            calendarDateField: 'property',
            calendarDatePropertyKey: 'due-date',
        },
    });

    assert.equal(viewQueryReferencesProperty({ query, key: 'owner', displayType: 'table' }), true);
    assert.equal(viewQueryReferencesProperty({ query, key: 'state', displayType: 'board' }), true);
    assert.equal(viewQueryReferencesProperty({ query, key: 'due-date', displayType: 'calendar' }), true);
    assert.equal(viewQueryReferencesProperty({ query, key: 'due-date', displayType: 'list' }), false);
    assert.equal(viewQueryReferencesProperty({ query, key: 'project', displayType: 'calendar' }), false);
});

test('property definition rename refreshes saved view filter labels', () => {
    const query = JSON.stringify({
        propertyFilters: [
            {
                key: 'state',
                name: 'State',
                valueType: 'select',
                operator: 'equals',
                value: 'doing',
            },
            {
                key: 'project',
                name: 'Project',
                valueType: 'text',
                operator: 'equals',
                value: 'ocean',
            },
        ],
        sortBy: 'updatedAt',
        sortOrder: 'desc',
    });

    const updatedQuery = renamePropertyFiltersInViewQuery({
        query,
        key: 'state',
        name: 'Workflow state',
    });

    assert.ok(updatedQuery);
    const parsed = JSON.parse(updatedQuery) as {
        propertyFilters: Array<{ key: string; name: string }>;
    };

    assert.deepEqual(
        parsed.propertyFilters.map((filter) => [filter.key, filter.name]),
        [
            ['state', 'Workflow state'],
            ['project', 'Project'],
        ],
    );
});

test('note property patches reject duplicate and conflicting keys before write', async () => {
    await assert.rejects(
        () =>
            updateNotePropertiesWithVersionGuard({
                id: 1,
                expectedUpdatedAt: '2026-05-30T00:00:00.000Z',
                patch: {
                    set: [
                        { key: 'state', valueType: 'select', value: 'todo' },
                        { key: ' State ', valueType: 'select', value: 'done' },
                    ],
                },
            }),
        (error: unknown) =>
            error instanceof InvalidNotePropertyInputError &&
            error.message === 'Property patch contains duplicate keys.',
    );

    await assert.rejects(
        () =>
            updateNotePropertiesWithVersionGuard({
                id: 1,
                expectedUpdatedAt: '2026-05-30T00:00:00.000Z',
                patch: {
                    set: [{ key: 'state', valueType: 'select', value: 'todo' }],
                    deleteKeys: [' State '],
                },
            }),
        (error: unknown) =>
            error instanceof InvalidNotePropertyInputError &&
            error.message === 'Property patch cannot set and delete the same key.',
    );
});

test('note property updates require the existing note version unless forced', async () => {
    await assert.rejects(
        () =>
            updateNotePropertiesWithVersionGuard({
                id: 1,
                patch: {
                    set: [{ key: 'state', valueType: 'select', value: 'todo' }],
                },
            }),
        (error: unknown) => error instanceof MissingNoteVersionError,
    );
});
