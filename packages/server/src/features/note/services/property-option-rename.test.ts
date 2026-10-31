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

const createRenameScenario = async () => {
    const state = await createState();
    const [todo, doing] = state.options;
    const rename = () =>
        updateNotePropertyDefinition({
            key: 'state',
            input: {
                options: [
                    { id: todo.id, label: 'Task', value: 'task', order: 0 },
                    { id: doing.id, label: 'Doing', value: 'doing', order: 1 },
                ],
            },
        });

    return { todo, doing, rename };
};

const createTodoFilterView = async () => {
    const group = await createViewGroup('Tasks');
    return createView(group.id, {
        propertyFilters: [{ key: 'state', valueType: 'select', operator: 'equals', value: 'todo' }],
    });
};

test('renaming an option value keeps the option id', async () => {
    const { todo, doing, rename } = await createRenameScenario();

    const updated = await rename();

    assert.deepEqual(
        updated?.options.map((option) => [option.id, option.value]),
        [
            [todo.id, 'task'],
            [doing.id, 'doing'],
        ],
    );
});

test('renaming an option value updates the value on notes that use the option', async () => {
    const { rename } = await createRenameScenario();
    const note = await createNoteInState('Kept', 'todo');

    await rename();

    assert.equal(await readStateValue(note.id), 'task');
});

test('renaming an option value updates saved view filters that match the option', async () => {
    const { rename } = await createRenameScenario();
    const view = await createTodoFilterView();

    await rename();

    assert.deepEqual(await readFilterValues(view.id), ['task']);
});

test('a trashed note restored after renaming its option value carries the new value', async () => {
    const { rename } = await createRenameScenario();
    const trashed = await createNoteInState('Trashed', 'todo');
    await trashNoteById(trashed.id);
    await rename();

    await restoreTrashedNoteById(trashed.id);

    assert.equal(await readStateValue(trashed.id), 'task');
});

test('a snapshot restored after renaming its option value carries the new value', async () => {
    const { rename } = await createRenameScenario();
    const note = await createNoteInState('Kept', 'todo');
    await captureNoteBaseline({ noteId: note.id, force: true });
    const snapshot = await models.noteSnapshot.findFirstOrThrow({
        where: { noteId: note.id },
        orderBy: { id: 'desc' },
    });
    await rename();
    const current = await models.note.findUniqueOrThrow({ where: { id: note.id } });
    await models.noteProperty.deleteMany({ where: { noteId: note.id } });

    await restoreNoteSnapshot(snapshot.id, { expectedUpdatedAt: current.updatedAt.toISOString() });

    assert.equal(await readStateValue(note.id), 'task');
});

const swapTodoAndDoingValues = async () => {
    const state = await createState();
    const [todo, doing] = state.options;

    return () =>
        updateNotePropertyDefinition({
            key: 'state',
            input: {
                options: [
                    { id: todo.id, label: 'Todo', value: 'doing', order: 0 },
                    { id: doing.id, label: 'Doing', value: 'todo', order: 1 },
                ],
            },
        });
};

test('swapping the values of two options in one update moves notes to the swapped value', async () => {
    const swap = await swapTodoAndDoingValues();
    const note = await createNoteInState('Swapped', 'todo');

    await swap();

    assert.equal(await readStateValue(note.id), 'doing');
});

test('swapping the values of two options in one update moves saved view filters to the swapped value', async () => {
    const swap = await swapTodoAndDoingValues();
    const view = await createTodoFilterView();

    await swap();

    assert.deepEqual(await readFilterValues(view.id), ['doing']);
});

test('an update that gives two options the same value is rejected', async () => {
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
