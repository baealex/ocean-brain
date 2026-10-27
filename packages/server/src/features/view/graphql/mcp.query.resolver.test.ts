import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import { createNoteFromMarkdown } from '~/features/note/services/authoring.js';
import models from '~/models.js';
import schema from '~/schema/index.js';
import { createView, createViewGroup } from '../services/workspace.js';

test('new GraphQL contracts serialize saved columns, groups, read ranges and backlinks', async () => {
    await models.propertyDefinition.create({
        data: {
            key: 'state',
            name: 'State',
            valueType: 'select',
            options: { create: { label: 'Todo', value: 'todo', order: 0 } },
        },
    });
    await models.propertyDefinition.create({ data: { key: 'hidden', name: 'Hidden', valueType: 'text' } });
    const note = await createNoteFromMarkdown({
        title: 'Target',
        markdown: '# Intro\n\nBefore\n\n# Result\n\nAfter',
        properties: {
            set: [
                { key: 'state', value: 'todo' },
                { key: 'hidden', value: 'large property' },
            ],
        },
    });
    const linking = await createNoteFromMarkdown({ title: 'Backlink', markdown: `[[Target]](note:${note.id})` });
    const group = await createViewGroup('Tasks');
    const view = await createView(group.id, {
        displayType: 'table',
        displayOptions: { tablePropertyKeys: ['state'] },
        propertyFilters: [{ key: 'state', valueType: 'select', operator: 'exists' }],
    });
    assert.ok(view);
    const result = await graphql({
        schema,
        source: `query ($id: ID!, $viewId: ID!) {
        notesByQuery(input: { propertyFilters: [] }) { totalCount query { tagNames mode sortBy sortOrder } notes { id properties(keys: []) { key } } }
        views(query: "Tasks") { totalCount views { groupTitle view { id displayType } } }
        readView(id: $viewId) { totalCount rows { note { id properties { key value } } } }
        noteRead(id: $id, heading: "Result", maxLength: 0) { status markdown note { id updatedAt } contentRange { start end totalLength } }
        backReferences(id: $id) { id }
    }`,
        variableValues: { id: note.id, viewId: view.id },
    });
    assert.equal(result.errors, undefined, JSON.stringify(result.errors));
    const data = JSON.parse(JSON.stringify(result.data));
    assert.equal(
        data.notesByQuery.notes.every((item: { properties: unknown[] }) => item.properties.length === 0),
        true,
    );
    assert.equal(data.views.totalCount, 1);
    assert.deepEqual(data.readView.rows[0].note.properties, [{ key: 'state', value: 'todo' }]);
    assert.match(data.noteRead.markdown, /# Result\n+After/);
    assert.doesNotMatch(data.noteRead.markdown, /Before/);
    assert.deepEqual(data.backReferences, [{ id: linking.id }]);
    const stale = await graphql({
        schema,
        source: `query ($id: ID!) { noteRead(id: $id, offset: 10, expectedUpdatedAt: "2000-01-01") { status reason markdown } }`,
        variableValues: { id: note.id },
    });
    assert.equal(stale.errors, undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(stale.data?.noteRead)), {
        status: 'failed',
        reason: 'NOTE_VERSION_CONFLICT',
        markdown: '',
    });
});
