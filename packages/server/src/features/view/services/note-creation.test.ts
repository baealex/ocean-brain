import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import { createNoteFromMarkdown } from '~/features/note/services/authoring.js';
import models from '~/models.js';
import schema from '~/schema/index.js';
import { createView, createViewGroup, getViewBoardColumn, getViewNotes, updateView } from './workspace.js';

const createState = () =>
    models.propertyDefinition.create({
        data: {
            key: 'state',
            name: 'State',
            valueType: 'select',
            options: {
                create: [
                    { label: 'Todo', value: 'todo', order: 0 },
                    { label: 'Doing', value: 'doing', order: 1 },
                ],
            },
        },
    });

test('creation inherits the project tags and equality properties without entering another project', async () => {
    const group = await createViewGroup('Projects');
    await createState();
    const view = await createView(group.id, {
        tagNames: ['@project-a', '@meeting'],
        propertyFilters: [{ key: 'state', valueType: 'select', operator: 'equals', value: 'todo' }],
    });
    const other = await createView(group.id, { tagNames: ['@project-b'] });

    const note = await createNoteFromMarkdown({
        title: 'Weekly meeting',
        markdown: 'Agenda',
        viewContext: { viewId: view.id },
    });
    const stored = await models.note.findUniqueOrThrow({ where: { id: Number(note.id) }, include: { tags: true } });

    assert.deepEqual(
        (await getViewNotes(view.id, { limit: 10, offset: 0 }))?.notes.map((item) => String(item.id)),
        [note.id],
    );
    assert.equal((await getViewNotes(other.id, { limit: 10, offset: 0 }))?.totalCount, 0);
    assert.deepEqual(stored.tags.map((tag) => tag.name).sort(), ['@meeting', '@project-a']);
    assert.match(stored.content, /@project-a/);
    assert.match(stored.content, /Agenda/);
    assert.equal(note.properties?.find((property) => property.key === 'state')?.value, 'todo');
});

test('an OR view requires a tag choice instead of silently assigning every alternative', async () => {
    const group = await createViewGroup('Alternatives');
    const view = await createView(group.id, { tagNames: ['@meeting', '@decision'], mode: 'or' });

    await assert.rejects(createNoteFromMarkdown({ title: 'Unclassified', viewContext: { viewId: view.id } }), /tag/i);

    assert.equal(await models.note.count(), 0);
});

test('an explicit OR choice creates a note with only the selected alternative', async () => {
    const group = await createViewGroup('Alternatives');
    const view = await createView(group.id, { tagNames: ['@meeting', '@decision'], mode: 'or' });

    const note = await createNoteFromMarkdown({
        title: 'Decision',
        viewContext: { viewId: view.id, tagNames: ['@decision'] },
    });
    const stored = await models.note.findUniqueOrThrow({ where: { id: Number(note.id) }, include: { tags: true } });

    assert.deepEqual(
        stored.tags.map((tag) => tag.name),
        ['@decision'],
    );
    assert.equal((await getViewNotes(view.id, { limit: 10, offset: 0 }))?.totalCount, 1);
});

test('range conditions request a value instead of inventing a default', async () => {
    const group = await createViewGroup('Dates');
    await models.propertyDefinition.create({ data: { key: 'due', name: 'Due date', valueType: 'date' } });
    const view = await createView(group.id, {
        propertyFilters: [{ key: 'due', valueType: 'date', operator: 'after', value: '2026-10-01' }],
    });

    const result = await graphql({
        schema,
        source: `query($id: ID!) {
        viewNoteCreationContext(viewId: $id) { properties { key defaultValue required } }
    }`,
        variableValues: { id: view.id },
    });

    assert.equal(result.errors, undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(result.data)), {
        viewNoteCreationContext: { properties: [{ key: 'due', defaultValue: null, required: true }] },
    });
});

test('the selected value must satisfy the current view before any note is committed', async () => {
    const group = await createViewGroup('Dates');
    await models.propertyDefinition.create({ data: { key: 'due', name: 'Due date', valueType: 'date' } });
    const view = await createView(group.id, {
        tagNames: ['@project-a'],
        propertyFilters: [{ key: 'due', valueType: 'date', operator: 'after', value: '2026-10-01' }],
    });

    await assert.rejects(
        createNoteFromMarkdown({
            title: 'Too early',
            properties: { set: [{ key: 'due', value: '2026-09-30' }] },
            viewContext: { viewId: view.id },
        }),
        /match.*view/i,
    );

    assert.equal(await models.note.count(), 0);
    assert.equal(await models.noteProperty.count(), 0);
    assert.equal(await models.tag.count({ where: { name: '@project-a' } }), 0);
});

for (const groupValue of ['doing', null]) {
    test(`board creation keeps the note in the requested ${groupValue ?? 'unassigned'} column`, async () => {
        const group = await createViewGroup('Tasks');
        await createState();
        const view = await createView(group.id, {
            displayType: 'board',
            tagNames: ['@project-a'],
            displayOptions: { boardGroupByPropertyKey: 'state' },
        });

        const note = await createNoteFromMarkdown({ title: 'Task', viewContext: { viewId: view.id, groupValue } });
        const column = await getViewBoardColumn(view.id, groupValue, { limit: 10 });

        assert.deepEqual(
            column?.notes.map((item) => String(item.id)),
            [note.id],
        );
        assert.equal(note.properties?.find((property) => property.key === 'state')?.value ?? null, groupValue);
    });
}

test('stale creation input is rejected when the saved view filters have changed', async () => {
    const group = await createViewGroup('Tasks');
    await createState();
    const view = await createView(group.id, {
        propertyFilters: [{ key: 'state', valueType: 'select', operator: 'equals', value: 'todo' }],
    });
    await updateView(view.id, {
        propertyFilters: [{ key: 'state', valueType: 'select', operator: 'equals', value: 'doing' }],
    });

    await assert.rejects(
        createNoteFromMarkdown({
            title: 'Stale task',
            properties: { set: [{ key: 'state', value: 'todo' }] },
            viewContext: { viewId: view.id },
        }),
        /match.*view/i,
    );

    assert.equal(await models.note.count(), 0);
});
