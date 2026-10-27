import assert from 'node:assert/strict';
import { test } from 'node:test';
import { graphql } from 'graphql';
import schema from '~/schema/index.js';
import { createView, createViewGroup, getViewById } from '../services/workspace.js';

test('legacy GraphQL callers read and update the same saved view as the renamed API', async () => {
    const group = await createViewGroup('Compatibility project');
    const view = await createView(group.id, { title: 'Meetings', tagNames: ['@meeting'] });

    const read = await graphql({
        schema,
        source: `query($id: ID!) {
            current: view(id: $id) { id groupId title }
            legacy: viewSection(id: $id) { id tabId title }
            viewWorkspace {
                activeGroupId groups { id views { id } }
                activeTabId tabs { id sections { id } }
            }
            oldList: viewSections(query: "Meetings") { sections { tabTitle section { id tabId } } }
            newList: views(query: "Meetings") { views { groupTitle view { id groupId } } }
            oldRows: readViewSection(id: $id) { section { id tabId } totalCount }
        }`,
        variableValues: { id: view.id },
    });

    assert.equal(read.errors, undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(read.data)), {
        current: { id: view.id, groupId: group.id, title: 'Meetings' },
        legacy: { id: view.id, tabId: group.id, title: 'Meetings' },
        viewWorkspace: {
            activeGroupId: group.id,
            groups: [{ id: group.id, views: [{ id: view.id }] }],
            activeTabId: group.id,
            tabs: [{ id: group.id, sections: [{ id: view.id }] }],
        },
        oldList: { sections: [{ tabTitle: group.title, section: { id: view.id, tabId: group.id } }] },
        newList: { views: [{ groupTitle: group.title, view: { id: view.id, groupId: group.id } }] },
        oldRows: { section: { id: view.id, tabId: group.id }, totalCount: 0 },
    });

    const update = await graphql({
        schema,
        source: 'mutation($id: ID!, $input: ViewSectionInput!) { updateViewSection(id: $id, input: $input) { id tabId title } }',
        variableValues: { id: view.id, input: { title: 'Updated by older client', tagNames: ['@meeting'] } },
    });

    assert.equal(update.errors, undefined);
    assert.equal((await getViewById(view.id))?.title, 'Updated by older client');
});
