import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import { integrationReadSchema } from '~/features/integration/schema.js';
import { createMcpCreateNoteHandler } from '~/features/note/http/mcp.js';
import { createNoteFromMarkdown } from '~/features/note/services/authoring.js';
import { trashNoteById } from '~/features/note/services/trash.js';
import models from '~/models.js';
import { blocksToMarkdown, markdownToBlocksJson } from '~/modules/blocknote.js';
import schema from '~/schema/index.js';
import { createView, createViewGroup, getViewById, getViewNotes, updateView } from './workspace.js';

test('view templates resolve placeholders without changing rich content or the original', async () => {
    const content = await markdownToBlocksJson('Workspace: {%workspace%}\n\n| Agenda |\n| --- |\n| {%workspace%} |');
    const template = await models.note.create({ data: { title: 'Outline', content } });
    await models.placeholder.create({
        data: { name: 'Workspace', template: 'workspace', replacement: 'Ocean "Brain" $&' },
    });
    const group = await createViewGroup('Project');
    const view = await createView(group.id, { defaultTemplateNoteId: String(template.id) });

    const created = await createNoteFromMarkdown({ title: 'Meeting', viewContext: { viewId: view.id } });
    const stored = await models.note.findUniqueOrThrow({ where: { id: Number(created.id) } });

    assert.match(await blocksToMarkdown(stored.content), /Ocean "Brain" \$&/);
    assert.doesNotMatch(stored.content, /\{%workspace%\}/);
    assert.equal(JSON.parse(stored.content)[1].type, 'table');
    assert.equal((await models.note.findUniqueOrThrow({ where: { id: template.id } })).content, content);
});

test('web view creation accepts an untitled note while Markdown authoring still requires a title', async () => {
    const group = await createViewGroup('Project');
    const view = await createView(group.id, { tagNames: ['@project'] });

    const result = await graphql({
        schema,
        source: 'mutation($id: ID!) { createNoteInView(viewId: $id, input: { title: "" }) { id title } }',
        variableValues: { id: view.id },
    });

    assert.equal(result.errors, undefined);
    const notes = await getViewNotes(view.id, { limit: 10, offset: 0 });
    assert.equal(notes?.totalCount, 1);
    assert.equal(notes?.notes[0]?.title, '');
    await assert.rejects(createNoteFromMarkdown({ title: '', viewContext: { viewId: view.id } }), /title is required/);
    assert.equal(await models.note.count(), 1);
});

test('a default template survives unrelated view settings updates', async () => {
    const template = await createNoteFromMarkdown({ title: 'Meeting outline', markdown: '# Agenda' });
    const group = await createViewGroup('Project');
    const view = await createView(group.id, {
        title: 'Meetings',
        tagNames: ['@meeting'],
        defaultTemplateNoteId: template.id,
    });

    await updateView(view.id, { title: 'Weekly meetings', tagNames: ['@meeting'], sortBy: 'title', sortOrder: 'asc' });
    const saved = await getViewById(view.id);
    const metadata = await graphql({
        schema: integrationReadSchema,
        source: 'query($id: ID!) { readView(id: $id) { view { defaultTemplateNoteId } } }',
        variableValues: { id: view.id },
    });

    assert.equal(saved?.defaultTemplateNoteId, template.id);
    assert.deepEqual(saved?.tagNames, ['@meeting']);
    assert.equal(saved?.sortBy, 'title');
    assert.equal(metadata.errors, undefined);
    assert.deepEqual(JSON.parse(JSON.stringify(metadata.data)), {
        readView: { view: { defaultTemplateNoteId: template.id } },
    });
});

test('creation copies the outline and properties while applying the current project and board column', async () => {
    await models.propertyDefinition.create({ data: { key: 'project', name: 'Project', valueType: 'text' } });
    await models.propertyDefinition.create({ data: { key: 'priority', name: 'Priority', valueType: 'number' } });
    await models.propertyDefinition.create({
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
    const template = await createNoteFromMarkdown({
        title: 'Meeting outline',
        markdown: '# Agenda\n\n- Discuss scope\n\n## Decisions\n\n| Project |\n| --- |\n| [@old-project] |',
        properties: {
            set: [
                { key: 'project', value: 'Other' },
                { key: 'priority', value: '2' },
                { key: 'state', value: 'todo' },
            ],
        },
    });
    const original = await models.note.findUniqueOrThrow({ where: { id: Number(template.id) } });
    const group = await createViewGroup('Project A');
    const view = await createView(group.id, {
        displayType: 'board',
        tagNames: ['@project-a'],
        defaultTemplateNoteId: template.id,
        displayOptions: { boardGroupByPropertyKey: 'state' },
        propertyFilters: [{ key: 'project', valueType: 'text', operator: 'equals', value: 'A' }],
    });

    const created = await createNoteFromMarkdown({
        title: 'Weekly planning',
        viewContext: { viewId: view.id, groupValue: 'doing' },
    });
    const stored = await models.note.findUniqueOrThrow({ where: { id: Number(created.id) }, include: { tags: true } });
    const markdown = await blocksToMarkdown(stored.content);

    assert.match(markdown, /# Agenda/);
    assert.match(markdown, /Discuss scope/);
    assert.match(markdown, /## Decisions/);
    assert.doesNotMatch(markdown, /@old-project/);
    assert.deepEqual(Object.fromEntries(created.properties?.map((property) => [property.key, property.value]) ?? []), {
        priority: '2',
        project: 'A',
        state: 'doing',
    });
    assert.deepEqual(
        stored.tags.map((tag) => tag.name),
        ['@project-a'],
    );
    assert.notEqual(created.id, template.id);
    assert.deepEqual(await models.note.findUniqueOrThrow({ where: { id: original.id } }), original);
    assert.deepEqual(
        (await getViewNotes(view.id, { limit: 10, offset: 0 }))?.notes.map((note) => String(note.id)),
        [created.id],
    );
});

test('template edits affect future creations and leave existing copies independent', async () => {
    const template = await createNoteFromMarkdown({ title: 'Outline', markdown: 'Original outline' });
    const group = await createViewGroup('Project');
    const view = await createView(group.id, { defaultTemplateNoteId: template.id });
    const first = await createNoteFromMarkdown({ title: 'First meeting', viewContext: { viewId: view.id } });

    await models.note.update({
        where: { id: Number(template.id) },
        data: { content: await markdownToBlocksJson('Revised outline') },
    });
    const second = await createNoteFromMarkdown({ title: 'Second meeting', viewContext: { viewId: view.id } });
    const firstStored = await models.note.findUniqueOrThrow({ where: { id: Number(first.id) } });
    const secondStored = await models.note.findUniqueOrThrow({ where: { id: Number(second.id) } });

    assert.match(await blocksToMarkdown(firstStored.content), /Original outline/);
    assert.match(await blocksToMarkdown(secondStored.content), /Revised outline/);
});

test('a deleted default template rejects creation without leaving a partial note', async () => {
    const template = await createNoteFromMarkdown({ title: 'Outline', markdown: 'Agenda' });
    const group = await createViewGroup('Project');
    const view = await createView(group.id, { defaultTemplateNoteId: template.id });
    await trashNoteById(Number(template.id));

    await assert.rejects(
        createNoteFromMarkdown({ title: 'Meeting', viewContext: { viewId: view.id } }),
        /template.*unavailable/i,
    );

    assert.equal(await models.note.count(), 0);
    assert.ok(await getViewById(view.id));
});

test('clearing a default template restores blank creation', async () => {
    const template = await createNoteFromMarkdown({ title: 'Outline', markdown: 'Agenda' });
    const group = await createViewGroup('Project');
    const view = await createView(group.id, { defaultTemplateNoteId: template.id });

    await updateView(view.id, { defaultTemplateNoteId: null });
    const created = await createNoteFromMarkdown({ title: 'Blank meeting', viewContext: { viewId: view.id } });
    const note = await models.note.findUniqueOrThrow({ where: { id: Number(created.id) } });

    assert.equal((await getViewById(view.id))?.defaultTemplateNoteId, null);
    assert.doesNotMatch(await blocksToMarkdown(note.content), /Agenda/);
});

test('explicit property choices can override or omit inherited values', async () => {
    await models.propertyDefinition.create({ data: { key: 'priority', name: 'Priority', valueType: 'number' } });
    await models.propertyDefinition.create({ data: { key: 'owner', name: 'Owner', valueType: 'text' } });
    const template = await createNoteFromMarkdown({
        title: 'Outline',
        properties: {
            set: [
                { key: 'priority', value: '2' },
                { key: 'owner', value: 'Alex' },
            ],
        },
    });
    const group = await createViewGroup('Project');
    const view = await createView(group.id, { defaultTemplateNoteId: template.id });

    const created = await createNoteFromMarkdown({
        title: 'Meeting',
        viewContext: { viewId: view.id },
        properties: { set: [{ key: 'priority', value: '3' }], deleteKeys: ['owner'] },
    });

    assert.deepEqual(
        created.properties?.map((property) => [property.key, property.value]),
        [['priority', '3']],
    );
});

test('an empty-property filter omits that property from the template defaults', async () => {
    await models.propertyDefinition.create({ data: { key: 'owner', name: 'Owner', valueType: 'text' } });
    const template = await createNoteFromMarkdown({
        title: 'Outline',
        properties: { set: [{ key: 'owner', value: 'Alex' }] },
    });
    const group = await createViewGroup('Unassigned');
    const view = await createView(group.id, {
        defaultTemplateNoteId: template.id,
        propertyFilters: [{ key: 'owner', valueType: 'text', operator: 'notExists' }],
    });

    const created = await createNoteFromMarkdown({ title: 'Meeting', viewContext: { viewId: view.id } });

    assert.deepEqual(created.properties, []);
    assert.deepEqual(
        (await getViewNotes(view.id, { limit: 10, offset: 0 }))?.notes.map((note) => String(note.id)),
        [created.id],
    );
});

test('an explicit Markdown body overrides the default outline', async () => {
    const template = await createNoteFromMarkdown({ title: 'Outline', markdown: 'Default outline' });
    const group = await createViewGroup('Project');
    const view = await createView(group.id, { defaultTemplateNoteId: template.id });

    const created = await createNoteFromMarkdown({
        title: 'Meeting',
        markdown: 'Custom body',
        viewContext: { viewId: view.id },
    });
    const stored = await models.note.findUniqueOrThrow({ where: { id: Number(created.id) } });

    assert.match(await blocksToMarkdown(stored.content), /Custom body/);
    assert.doesNotMatch(await blocksToMarkdown(stored.content), /Default outline/);
});

test('MCP creation can omit inherited properties through the real authoring handler', async () => {
    await models.propertyDefinition.create({ data: { key: 'owner', name: 'Owner', valueType: 'text' } });
    const template = await createNoteFromMarkdown({
        title: 'Outline',
        markdown: 'Agenda',
        properties: { set: [{ key: 'owner', value: 'Alex' }] },
    });
    const group = await createViewGroup('Project');
    const view = await createView(group.id, { defaultTemplateNoteId: template.id, tagNames: ['@project-a'] });
    const handler = createMcpCreateNoteHandler(undefined, () => undefined);
    const reply = {
        status() {
            return this;
        },
        send() {
            return this;
        },
    };

    await handler(
        {
            body: { title: 'MCP meeting', viewContext: { viewId: view.id }, properties: { deleteKeys: ['owner'] } },
        } as never,
        reply as never,
    );
    const created = await models.note.findFirstOrThrow({
        where: { title: 'MCP meeting' },
        include: { properties: true },
    });

    assert.deepEqual(created.properties, []);
    assert.match(await blocksToMarkdown(created.content), /Agenda/);
});
