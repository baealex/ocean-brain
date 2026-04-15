import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createCreatePlaceholderMutationResolver,
    createDeletePlaceholderMutationResolver,
    createUpdatePlaceholderMutationResolver,
} from './placeholder.mutation.resolver.js';

test('createPlaceholder resolver forwards placeholder fields to the create dependency', async () => {
    let createInput: unknown;

    const resolver = createCreatePlaceholderMutationResolver({
        createPlaceholder: async (input) => {
            createInput = input;
            return {
                id: 5,
                ...input,
            };
        },
    });

    const result = await resolver(null, {
        name: 'Meeting title',
        template: 'meeting-title',
        replacement: 'Roadmap Sync',
    });

    assert.deepEqual(createInput, {
        name: 'Meeting title',
        template: 'meeting-title',
        replacement: 'Roadmap Sync',
    });
    assert.deepEqual(result, {
        id: 5,
        name: 'Meeting title',
        template: 'meeting-title',
        replacement: 'Roadmap Sync',
    });
});

test('updatePlaceholder resolver preserves legacy behavior by returning the pre-update record', async () => {
    let updateInput: unknown;

    const resolver = createUpdatePlaceholderMutationResolver({
        findPlaceholderById: async (id) => ({
            id,
            name: 'Old name',
            template: 'old-template',
            replacement: 'Old value',
            createdAt: new Date('2026-04-01T00:00:00.000Z'),
            updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        }),
        updatePlaceholder: async (input) => {
            updateInput = input;
        },
    });

    const result = await resolver(null, {
        id: '8',
        name: 'New name',
        template: 'new-template',
        replacement: 'New value',
    });

    assert.deepEqual(updateInput, {
        id: 8,
        name: 'New name',
        template: 'new-template',
        replacement: 'New value',
    });
    assert.deepEqual(result, {
        id: 8,
        name: 'Old name',
        template: 'old-template',
        replacement: 'Old value',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    });
});

test('updatePlaceholder resolver throws when the placeholder does not exist', async () => {
    const resolver = createUpdatePlaceholderMutationResolver({
        findPlaceholderById: async () => null,
        updatePlaceholder: async () => undefined,
    });

    await assert.rejects(() => resolver(null, { id: '3' }), /Placeholder not found/);
});

test('deletePlaceholder resolver returns false when the placeholder does not exist', async () => {
    let deleteCalled = false;

    const resolver = createDeletePlaceholderMutationResolver({
        findPlaceholderById: async () => null,
        deletePlaceholder: async () => {
            deleteCalled = true;
        },
    });

    const result = await resolver(null, { id: '12' });

    assert.equal(result, false);
    assert.equal(deleteCalled, false);
});

test('deletePlaceholder resolver deletes existing placeholders with a normalized id', async () => {
    let deletedId = 0;

    const resolver = createDeletePlaceholderMutationResolver({
        findPlaceholderById: async (id) => ({
            id,
            name: 'Greeting',
            template: 'hello',
            replacement: 'Hello there',
            createdAt: new Date('2026-04-01T00:00:00.000Z'),
            updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        }),
        deletePlaceholder: async (id) => {
            deletedId = id;
        },
    });

    const result = await resolver(null, { id: '12' });

    assert.equal(result, true);
    assert.equal(deletedId, 12);
});
