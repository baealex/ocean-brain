import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createNotePropertyDefinition,
    InvalidNotePropertyInputError,
    normalizePropertyKey,
    updateNotePropertiesWithVersionGuard,
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
