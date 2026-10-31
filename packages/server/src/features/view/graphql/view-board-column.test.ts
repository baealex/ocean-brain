import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import { createNoteFromMarkdown } from '~/features/note/services/authoring.js';
import models from '~/models.js';
import schema from '~/schema/index.js';
import { createView, createViewGroup } from '../services/workspace.js';

const createSelectProperty = (key: string, name: string, options: Array<{ label: string; value: string }>) =>
    models.propertyDefinition.create({
        data: {
            key,
            name,
            valueType: 'select',
            options: { create: options.map((option, order) => ({ ...option, order })) },
        },
    });

test('board columns return the tags and properties shown on cards', async () => {
    const group = await createViewGroup('Tasks');
    await createSelectProperty('state', 'State', [{ label: 'Todo', value: 'todo' }]);
    await createSelectProperty('project', 'Project', [{ label: 'Ocean Brain', value: 'ocean-brain' }]);
    await createNoteFromMarkdown({
        title: 'Card task',
        markdown: '[@product] Board card',
        properties: {
            set: [
                { key: 'state', value: 'todo' },
                { key: 'project', value: 'ocean-brain' },
            ],
        },
    });
    const view = await createView(group.id, {
        displayType: 'board',
        displayOptions: { boardGroupByPropertyKey: 'state' },
    });

    const result = await graphql({
        schema,
        source: `query($id: ID!) {
        viewBoardColumn(id: $id, optionValue: "todo") {
            totalCount
            notes { title createdAt tags { name } properties { key value option { label } } }
        }
    }`,
        variableValues: { id: view.id },
    });

    assert.equal(result.errors, undefined);
    const column = JSON.parse(JSON.stringify(result.data)).viewBoardColumn;
    const [note] = column.notes;

    assert.equal(column.totalCount, 1);
    assert.equal(note.title, 'Card task');
    assert.equal(typeof note.createdAt, 'string');
    assert.deepEqual(note.tags, [{ name: '@product' }]);
    assert.deepEqual(
        [...note.properties].sort((left: { key: string }, right: { key: string }) => left.key.localeCompare(right.key)),
        [
            { key: 'project', value: 'ocean-brain', option: { label: 'Ocean Brain' } },
            { key: 'state', value: 'todo', option: { label: 'Todo' } },
        ],
    );
});
