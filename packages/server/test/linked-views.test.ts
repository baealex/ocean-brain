import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import { integrationReadSchema } from '../src/features/integration/schema.js';
import { createNoteFromMarkdown } from '../src/features/note/services/authoring.js';
import { appendNoteMarkdown, replaceNoteMarkdown } from '../src/features/note/services/markdown-intent-write.js';
import { createView, createViewGroup, deleteView } from '../src/features/view/services/workspace.js';
import models from '../src/models.js';
import { blocksToMarkdown, markdownToBlocksJson } from '../src/modules/blocknote.js';
import { isBlockNoteTreeNode, walkBlockNoteTree } from '../src/modules/blocknote-tree.js';

const linkedView = (viewId: string, viewTitle = 'Meetings') => ({
    type: 'linkedView',
    props: { viewId, viewTitle },
    children: [],
});
const paragraph = (text: string) => ({
    type: 'paragraph',
    content: [{ type: 'text', text, styles: {} }],
    children: [],
});
const importDeps = {
    ensureTag: async () => {
        throw new Error('Unexpected tag');
    },
    findNotesByTitle: async () => [],
};
const storedViewIds = (content: string) => {
    const ids: string[] = [];
    walkBlockNoteTree(JSON.parse(content), (block) => {
        if (block.type === 'linkedView' && isBlockNoteTreeNode(block.props) && typeof block.props.viewId === 'string')
            ids.push(block.props.viewId);
    });
    return ids;
};
const readNote = (id: number, maxLength = 4) =>
    graphql({
        schema: integrationReadSchema,
        source: `query($id: ID!, $maxLength: Int!) { noteRead(id: $id, maxLength: $maxLength) {
        markdown contentRange { hasMore } linkedViews { viewId title groupId groupTitle displayType status }
    } }`,
        variableValues: { id: String(id), maxLength },
    });

test('Markdown round trips preserve nested view IDs and surrounding prose', async () => {
    // Arrange
    const content = JSON.stringify([
        paragraph('Before the views.'),
        linkedView('42', 'Meetings [weekly]'),
        { ...paragraph('Tasks'), children: [linkedView('43', 'Tasks')] },
        paragraph('After the views.'),
    ]);

    // Act
    const markdown = await blocksToMarkdown(content);
    const restored = await markdownToBlocksJson(markdown, importDeps);
    const rendered = await blocksToMarkdown(restored);

    // Assert
    assert.deepEqual(storedViewIds(restored), ['42', '43']);
    assert.match(rendered, /Before the views/);
    assert.match(rendered, /After the views/);
    assert.match(rendered, /Meetings/);
});

test('a view link inside a code block remains literal Markdown', async () => {
    // Arrange
    const markdown = '```md\n[View: Meetings](/views/notes?viewId=42)\n```';

    // Act
    const restored = await markdownToBlocksJson(markdown, importDeps);
    const rendered = await blocksToMarkdown(restored);

    // Assert
    assert.deepEqual(storedViewIds(restored), []);
    assert.equal(JSON.parse(restored)[0].type, 'codeBlock');
    assert.match(rendered, /viewId=42/);
});

test('Markdown note creation persists a usable saved-view connection', async () => {
    // Arrange
    const group = await createViewGroup('Project A');
    const view = await createView(group.id, { title: 'Meetings' });
    const markdown = `Before the view.\n\n[View: Meetings](/views/notes?viewId=${view.id})\n\nAfter the view.`;

    // Act
    const created = await createNoteFromMarkdown({ title: 'Project overview', markdown });
    const stored = await models.note.findUniqueOrThrow({ where: { id: Number(created.id) } });
    const rendered = await blocksToMarkdown(stored.content);

    // Assert
    assert.deepEqual(storedViewIds(stored.content), [view.id]);
    assert.match(rendered, /Before the view/);
    assert.match(rendered, /After the view/);
});

for (const operation of ['append', 'replace'] as const) {
    test(`${operation} body edits retain the existing view connection and unrelated prose`, async () => {
        // Arrange: start with a stored connection, independently of Markdown creation.
        const group = await createViewGroup('Project A');
        const view = await createView(group.id, { title: 'Meetings' });
        const note = await models.note.create({
            data: {
                title: 'Project overview',
                content: JSON.stringify([
                    paragraph('Before the view.'),
                    linkedView(view.id),
                    paragraph('After the view.'),
                ]),
            },
        });
        const version = note.updatedAt.toISOString();

        // Act: one public write operation per scenario.
        const result =
            operation === 'append'
                ? await appendNoteMarkdown({
                      id: note.id,
                      expectedUpdatedAt: version,
                      intent: 'Record a decision',
                      insertion: 'Decision summary.',
                  })
                : await replaceNoteMarkdown({
                      id: note.id,
                      expectedUpdatedAt: version,
                      intent: 'Add the decision to the document',
                      replacement: `Before the view.\n\n[View: Meetings](/views/notes?viewId=${view.id})\n\nAfter the view.\n\nDecision summary.`,
                  });
        const stored = await models.note.findUniqueOrThrow({ where: { id: note.id } });
        const rendered = await blocksToMarkdown(stored.content);

        // Assert
        assert.equal(result.status, 'applied');
        assert.deepEqual(storedViewIds(stored.content), [view.id]);
        assert.match(rendered, /Before the view/);
        assert.match(rendered, /After the view/);
        assert.match(rendered, /Decision summary/);
    });
}

test('a partial note read discovers each connected view once across the whole note', async () => {
    // Arrange: the connection is outside the returned range and repeats in another block.
    const group = await createViewGroup('Project A');
    const view = await createView(group.id, { title: 'Current meetings', tagNames: ['@meeting'] });
    const note = await models.note.create({
        data: {
            title: 'Project overview',
            content: JSON.stringify([
                { ...paragraph('A long introduction before the view.'), children: [linkedView(view.id, 'Old title')] },
                linkedView(view.id),
            ]),
        },
    });

    // Act
    const result = await readNote(note.id);

    // Assert: metadata comes from the current saved view, not the cached block label.
    assert.equal(result.errors, undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(result.data)), {
        noteRead: {
            markdown: 'A lo',
            contentRange: { hasMore: true },
            linkedViews: [
                {
                    viewId: view.id,
                    title: 'Current meetings',
                    groupId: group.id,
                    groupTitle: 'Project A',
                    displayType: 'list',
                    status: 'available',
                },
            ],
        },
    });
});

test('a deleted view is reported as missing without rewriting the containing note', async () => {
    // Arrange: the target really existed and was deleted; an empty query is not a missing target.
    const group = await createViewGroup('Project A');
    const view = await createView(group.id, { title: 'Meetings' });
    const note = await models.note.create({
        data: {
            title: 'Project overview',
            content: JSON.stringify([paragraph('Keep my context.'), linkedView(view.id)]),
        },
    });
    await deleteView(view.id);

    // Act
    const result = await readNote(note.id);
    const stored = await models.note.findUniqueOrThrow({ where: { id: note.id } });

    // Assert
    assert.equal(result.errors, undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(result.data)).noteRead.linkedViews, [
        {
            viewId: view.id,
            title: 'Meetings',
            groupId: null,
            groupTitle: null,
            displayType: null,
            status: 'missing',
        },
    ]);
    assert.equal(stored.content, note.content);
    assert.equal(stored.updatedAt.getTime(), note.updatedAt.getTime());
});
