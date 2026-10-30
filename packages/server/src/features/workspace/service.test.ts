import assert from 'node:assert/strict';
import { test } from 'node:test';
import { graphql } from 'graphql';
import { createNoteWithContent } from '~/features/note/services/create.js';
import { createNotePropertyDefinition } from '~/features/note/services/properties.js';
import { createHybridNoteSearch, searchNotesHybrid } from '~/features/search/hybrid-search.js';
import { createView, createViewGroup, getViewNotes, getViewWorkspace } from '~/features/view/services/workspace.js';
import models from '~/models.js';
import schema from '~/schema/index.js';
import { createWorkspace, updateWorkspace } from './service.js';

test('workspace search selects lexical and semantic candidates before ranking and pagination', async () => {
    const workspace = await createWorkspace('Diet');
    const local = await createNoteWithContent({ workspaceId: workspace.id, title: 'Rare boundary', content: '[]' });
    await models.note.createMany({
        data: Array.from({ length: 100 }, () => ({
            title: 'Rare boundary',
            content: '[]',
            searchableText: 'Rare boundary',
            searchableTextVersion: 1,
        })),
    });
    const scope = { kind: 'workspace', workspaceId: String(workspace.id) } as const;
    const lexical = await searchNotesHybrid({ query: 'Rare boundary', limit: 1, offset: 0, mode: 'lexical', scope });
    assert.deepEqual(
        lexical.notes.map((note) => note.id),
        [local.id],
    );
    assert.equal(lexical.totalCount, 1);

    const semantic = createHybridNoteSearch({
        listLexicalNoteIds: async () => [],
        listEligibleNoteIds: async (id) => {
            assert.equal(id, workspace.id);
            return [local.id];
        },
        trySemanticSearch: async (_query, _limit, eligible) => {
            assert.deepEqual(eligible, [local.id]);
            return { available: true, used: true, matches: [{ noteId: local.id, distance: 0 }], error: null };
        },
        findNotesByIds: async (ids, id) => models.note.findMany({ where: { id: { in: ids }, workspaceId: id } }),
    });
    assert.deepEqual(
        (await semantic({ query: 'boundary', limit: 1, offset: 0, mode: 'semantic', scope })).notes.map(
            (note) => note.id,
        ),
        [local.id],
    );
});

test('existing capture defaults to the original space and scoped views exclude unrelated notes', async () => {
    const workspace = await createWorkspace('Diet');
    const original = await createNoteWithContent({ title: 'Idea', content: '[]' });
    const diet = await createNoteWithContent({ title: 'Record', content: '[]', workspaceId: workspace.id });
    const group = await createViewGroup('Records', workspace.id);
    const view = await createView(group.id, { title: 'All diet records' });

    const result = await getViewNotes(view.id, { limit: 25, offset: 0 });

    assert.equal(original.workspaceId, 1);
    assert.equal(diet.workspaceId, workspace.id);
    assert.deepEqual(
        result?.notes.map((note) => note.id),
        [diet.id],
    );
    assert.deepEqual(
        (await getViewWorkspace(workspace.id)).groups.map((group) => group.title),
        ['Records'],
    );
    assert.deepEqual((await getViewWorkspace()).groups, []);
});

test('the same display name has independent definitions and foreign properties roll back note creation', async () => {
    const workspace = await createWorkspace('Tasks');
    const base = await createNotePropertyDefinition({ name: 'Status', valueType: 'text' });
    const task = await createNotePropertyDefinition({ name: 'Status', valueType: 'text', workspaceId: workspace.id });

    await assert.rejects(
        createNoteWithContent({
            title: 'Wrong field',
            content: '[]',
            workspaceId: workspace.id,
            properties: { set: [{ key: base.key, valueType: 'text', value: 'Open' }] },
        }),
        { extensions: { code: 'WORKSPACE_MISMATCH' } },
    );

    assert.notEqual(base.key, task.key);
    assert.equal(base.name, task.name);
    assert.equal(await models.note.count(), 0);
});

test('view display fields and templates must belong to the view workspace', async () => {
    const workspace = await createWorkspace('Diet');
    const group = await createViewGroup('Diet', workspace.id);
    const field = await createNotePropertyDefinition({ key: 'priority', valueType: 'text' });
    const template = await createNoteWithContent({ title: 'Template', content: '[]' });

    await assert.rejects(
        createView(group.id, {
            title: 'Wrong field',
            displayType: 'table',
            displayOptions: { tablePropertyKeys: [field.key] },
        }),
        { extensions: { code: 'WORKSPACE_MISMATCH' } },
    );
    await assert.rejects(
        createView(group.id, { title: 'Wrong template', defaultTemplateNoteId: String(template.id) }),
        { extensions: { code: 'WORKSPACE_MISMATCH' } },
    );
    assert.equal(await models.view.count(), 0);
});

test('archiving preserves records and blocks new capture until the workspace is restored', async () => {
    const workspace = await createWorkspace('Diet');
    const note = await createNoteWithContent({ title: 'Record', content: '[]', workspaceId: workspace.id });
    await updateWorkspace(String(workspace.id), { archived: true });

    await assert.rejects(createNoteWithContent({ title: 'New', content: '[]', workspaceId: workspace.id }), {
        extensions: { code: 'WORKSPACE_ARCHIVED' },
    });
    assert.equal((await models.note.findUniqueOrThrow({ where: { id: note.id } })).workspaceId, workspace.id);

    await updateWorkspace(String(workspace.id), { archived: false });
    const next = await createNoteWithContent({ title: 'New', content: '[]', workspaceId: workspace.id });
    assert.equal(next.workspaceId, workspace.id);
    await assert.rejects(updateWorkspace('1', { archived: true }), {
        extensions: { code: 'DEFAULT_WORKSPACE_REQUIRED' },
    });
});

test('parallel scoped queries keep notes, property catalogs, views and tag counts independent', async () => {
    const diet = await createWorkspace('Diet');
    const tasks = await createWorkspace('Tasks');
    const tag = await models.tag.create({ data: { name: '@record' } });
    for (const [workspaceId, count] of [
        [diet.id, 1],
        [tasks.id, 3],
    ]) {
        await createNotePropertyDefinition({ name: 'Status', valueType: 'text', workspaceId });
        const group = await createViewGroup('Records', workspaceId);
        await createView(group.id, { title: 'Records' });
        for (let i = 0; i < count; i++) {
            await createNoteWithContent({ workspaceId, title: `Record ${i}`, content: '[]', tagIds: [String(tag.id)] });
        }
    }
    const read = (workspaceId?: number) =>
        graphql({
            schema,
            source: `query($scope: WorkspaceScopeInput) {
            allNotes(searchFilter: {query: ""}, pagination: {limit: 25, offset: 0}, scope: $scope) { totalCount notes { workspaceId } }
            notePropertyKeys(scope: $scope) { totalCount keys { key workspaceId } }
            views(scope: $scope) { totalCount views { view { workspaceId } } }
            allTags(searchFilter: {query: ""}, pagination: {limit: 25, offset: 0}, scope: $scope) { tags { referenceCount } }
        }`,
            variableValues: {
                scope: workspaceId ? { kind: 'workspace', workspaceId: String(workspaceId) } : undefined,
            },
        });

    const [dietResult, taskResult, allResult] = await Promise.all([read(diet.id), read(tasks.id), read()]);

    for (const [result, count] of [
        [dietResult, 1],
        [taskResult, 3],
        [allResult, 4],
    ] as const) {
        assert.equal(result.errors, undefined);
        assert.equal((result.data?.allNotes as { totalCount: number }).totalCount, count);
        assert.deepEqual(JSON.parse(JSON.stringify(result.data?.allTags)), { tags: [{ referenceCount: count }] });
    }
    assert.equal((dietResult.data?.notePropertyKeys as { totalCount: number }).totalCount, 1);
    assert.equal((taskResult.data?.views as { totalCount: number }).totalCount, 1);
    assert.equal((allResult.data?.notePropertyKeys as { totalCount: number }).totalCount, 2);
});
