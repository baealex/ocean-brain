import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createView, createViewGroup } from '~/features/view/services/workspace.js';
import models from '~/models.js';
import { createNoteWithContent } from './create.js';
import {
    createNotePropertyDefinition,
    InvalidNotePropertyInputError,
    listNoteProperties,
    updateNotePropertyDefinition,
} from './properties.js';
import { captureNoteBaseline, restoreNoteSnapshot } from './snapshot.js';
import { restoreTrashedNoteById, trashNoteById } from './trash.js';

const createState = () =>
    createNotePropertyDefinition({
        key: 'state',
        name: 'State',
        valueType: 'select',
        options: [
            { label: 'Todo', value: 'todo' },
            { label: 'Doing', value: 'doing' },
        ],
    });

const createNoteInState = (title: string, value: string) =>
    createNoteWithContent({
        title,
        content: '[]',
        properties: { set: [{ key: 'state', valueType: 'select', value }] },
    });

const readStateValue = async (noteId: number) =>
    (await listNoteProperties(noteId)).find((property) => property.key === 'state')?.value;

const readFilterValues = async (viewId: string) => {
    const view = await models.view.findUniqueOrThrow({ where: { id: Number(viewId) } });
    const query = JSON.parse(view.query ?? '{}') as { propertyFilters?: Array<{ value?: string }> };
    return (query.propertyFilters ?? []).map((filter) => filter.value);
};

test('renaming an option value keeps notes, saved views, trash and snapshots on the same option', async () => {
    const state = await createState();
    const [todo, doing] = state.options;
    const kept = await createNoteInState('Kept', 'todo');
    await captureNoteBaseline({ noteId: kept.id, force: true });
    const snapshot = await models.noteSnapshot.findFirstOrThrow({
        where: { noteId: kept.id },
        orderBy: { id: 'desc' },
    });
    const trashed = await createNoteInState('Trashed', 'todo');
    await trashNoteById(trashed.id);
    const group = await createViewGroup('Tasks');
    const view = await createView(group.id, {
        propertyFilters: [{ key: 'state', valueType: 'select', operator: 'equals', value: 'todo' }],
    });

    const updated = await updateNotePropertyDefinition({
        key: 'state',
        input: {
            options: [
                { id: todo.id, label: 'Task', value: 'task', order: 0 },
                { id: doing.id, label: 'Doing', value: 'doing', order: 1 },
            ],
        },
    });

    assert.deepEqual(
        updated?.options.map((option) => [option.id, option.value]),
        [
            [todo.id, 'task'],
            [doing.id, 'doing'],
        ],
    );
    assert.equal(await readStateValue(kept.id), 'task');
    assert.deepEqual(await readFilterValues(view.id), ['task']);

    await restoreTrashedNoteById(trashed.id);
    assert.equal(await readStateValue(trashed.id), 'task');

    const current = await models.note.findUniqueOrThrow({ where: { id: kept.id } });
    await models.noteProperty.deleteMany({ where: { noteId: kept.id } });
    await restoreNoteSnapshot(snapshot.id, { expectedUpdatedAt: current.updatedAt.toISOString() });
    assert.equal(await readStateValue(kept.id), 'task');
});

test('two options can swap values in one update', async () => {
    const state = await createState();
    const [todo, doing] = state.options;
    const note = await createNoteInState('Swapped', 'todo');
    const group = await createViewGroup('Tasks');
    const view = await createView(group.id, {
        propertyFilters: [{ key: 'state', valueType: 'select', operator: 'equals', value: 'todo' }],
    });

    await updateNotePropertyDefinition({
        key: 'state',
        input: {
            options: [
                { id: todo.id, label: 'Todo', value: 'doing', order: 0 },
                { id: doing.id, label: 'Doing', value: 'todo', order: 1 },
            ],
        },
    });

    assert.equal(await readStateValue(note.id), 'doing');
    assert.deepEqual(await readFilterValues(view.id), ['doing']);
});

test('an option cannot be renamed to a value another option keeps', async () => {
    const state = await createState();
    const [todo, doing] = state.options;

    await assert.rejects(
        updateNotePropertyDefinition({
            key: 'state',
            input: {
                options: [
                    { id: todo.id, label: 'Todo', value: 'doing', order: 0 },
                    { id: doing.id, label: 'Doing', value: 'doing', order: 1 },
                ],
            },
        }),
        (error: unknown) =>
            error instanceof InvalidNotePropertyInputError &&
            error.message === 'Property options contain duplicate values.',
    );
});
