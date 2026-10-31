import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNoteWithContent } from '~/features/note/services/create.js';
import { createNotePropertyDefinition, listNoteProperties } from '~/features/note/services/properties.js';
import { getNoteSnapshotRestoreContext, restoreNoteSnapshot } from '~/features/note/services/snapshot.js';
import { restoreTrashedNoteById, trashNoteById } from '~/features/note/services/trash.js';
import { createView, createViewGroup } from '~/features/view/services/workspace.js';
import models from '~/models.js';
import { moveNoteToWorkspace, previewNoteWorkspaceMove } from './move.js';
import { createWorkspace, updateWorkspace } from './service.js';

test('a mapped move retains the original note, links and values, and records both workspace versions', async () => {
    const target = await createWorkspace('Diet');
    const originalField = await createNotePropertyDefinition({ key: 'weight', name: 'Weight', valueType: 'number' });
    const targetField = await createNotePropertyDefinition({
        name: 'Weight',
        valueType: 'number',
        workspaceId: target.id,
    });
    const note = await createNoteWithContent({
        title: 'Record',
        content: '[]',
        properties: { set: [{ key: originalField.key, valueType: 'number', value: '70.5' }] },
    });
    await models.noteReference.create({ data: { sourceNoteId: note.id, targetNoteId: note.id } });

    const preview = await previewNoteWorkspaceMove(String(note.id), String(target.id));
    const moved = await moveNoteToWorkspace({
        id: String(note.id),
        targetWorkspaceId: String(target.id),
        expectedUpdatedAt: preview.expectedUpdatedAt,
        mappings: [{ sourceKey: originalField.key, targetKey: targetField.key }],
    });

    assert.equal(moved.id, note.id);
    assert.equal(moved.workspaceId, target.id);
    assert.equal(moved.content, note.content);
    assert.equal(await models.noteReference.count(), 1);
    assert.deepEqual(
        (await listNoteProperties(note.id)).map(({ key, value }) => ({ key, value })),
        [{ key: targetField.key, value: '70.5' }],
    );
    const snapshots = await models.noteSnapshot.findMany({ where: { noteId: note.id }, orderBy: { id: 'asc' } });
    assert.deepEqual(
        snapshots.map((snapshot) => JSON.parse(snapshot.payload).workspaceId),
        [1, target.id],
    );
    assert.equal(JSON.parse(snapshots[0].payload).properties[0].key, originalField.key);
});

test('a note without properties moves without any mappings', async () => {
    const target = await createWorkspace('Diet');
    const note = await createNoteWithContent({ title: 'Plain memo', content: '[]' });

    const preview = await previewNoteWorkspaceMove(String(note.id), String(target.id));
    const moved = await moveNoteToWorkspace({
        id: String(note.id),
        targetWorkspaceId: String(target.id),
        expectedUpdatedAt: preview.expectedUpdatedAt,
        mappings: [],
    });

    assert.equal(moved.workspaceId, target.id);
    assert.deepEqual(await listNoteProperties(note.id), []);
    assert.equal(await models.noteSnapshot.count({ where: { noteId: note.id } }), 2);
});

test('an invalid mapping leaves the note, properties and snapshots unchanged', async () => {
    const target = await createWorkspace('Diet');
    const source = await createNotePropertyDefinition({ key: 'weight', valueType: 'number' });
    const note = await createNoteWithContent({
        title: 'Record',
        content: '[]',
        properties: { set: [{ key: source.key, valueType: 'number', value: '70' }] },
    });

    await assert.rejects(
        moveNoteToWorkspace({
            id: String(note.id),
            targetWorkspaceId: String(target.id),
            expectedUpdatedAt: note.updatedAt.toISOString(),
            mappings: [],
        }),
        { extensions: { code: 'NOTE_MOVE_PROPERTY_MAPPING_REQUIRED' } },
    );

    assert.equal((await models.note.findUniqueOrThrow({ where: { id: note.id } })).workspaceId, 1);
    assert.equal((await listNoteProperties(note.id))[0].value, '70');
    assert.equal(await models.noteSnapshot.count(), 0);
});

test('a stale move and a template move do not change the note workspace', async () => {
    const target = await createWorkspace('Diet');
    const note = await createNoteWithContent({ title: 'Template', content: '[]' });
    const group = await createViewGroup('Records');
    await createView(group.id, { title: 'Records', defaultTemplateNoteId: String(note.id) });

    await assert.rejects(
        moveNoteToWorkspace({
            id: String(note.id),
            targetWorkspaceId: String(target.id),
            expectedUpdatedAt: new Date(0).toISOString(),
            mappings: [],
        }),
        { code: 'NOTE_UPDATE_CONFLICT' },
    );
    await assert.rejects(
        moveNoteToWorkspace({
            id: String(note.id),
            targetWorkspaceId: String(target.id),
            expectedUpdatedAt: note.updatedAt.toISOString(),
            mappings: [],
        }),
        { extensions: { code: 'NOTE_TEMPLATE_IN_USE' } },
    );

    assert.equal((await models.note.findUniqueOrThrow({ where: { id: note.id } })).workspaceId, 1);
    assert.equal(await models.noteSnapshot.count(), 0);
});

test('trash restoration preserves workspace ownership and waits for unarchive', async () => {
    const workspace = await createWorkspace('Diet');
    const note = await createNoteWithContent({ title: 'Record', content: '[]', workspaceId: workspace.id });
    await trashNoteById(note.id);
    await updateWorkspace(String(workspace.id), { archived: true });

    await assert.rejects(restoreTrashedNoteById(note.id), { extensions: { code: 'WORKSPACE_ARCHIVED' } });
    assert.equal((await models.deletedNote.findUniqueOrThrow({ where: { id: note.id } })).workspaceId, workspace.id);
    await updateWorkspace(String(workspace.id), { archived: false });
    const restored = await restoreTrashedNoteById(note.id);
    assert.equal(restored?.workspaceId, workspace.id);
});

test('restoring a historical version maps its fields into the current workspace without moving the note', async () => {
    const target = await createWorkspace('Diet');
    const originalField = await createNotePropertyDefinition({ key: 'weight', name: 'Weight', valueType: 'number' });
    const targetField = await createNotePropertyDefinition({
        name: 'Weight',
        valueType: 'number',
        workspaceId: target.id,
    });
    const note = await createNoteWithContent({
        title: 'Record',
        content: '[]',
        properties: { set: [{ key: originalField.key, valueType: 'number', value: '70' }] },
    });
    const moved = await moveNoteToWorkspace({
        id: String(note.id),
        targetWorkspaceId: String(target.id),
        expectedUpdatedAt: note.updatedAt.toISOString(),
        mappings: [{ sourceKey: originalField.key, targetKey: targetField.key }],
    });
    const snapshot = await models.noteSnapshot.findFirstOrThrow({ where: { noteId: note.id }, orderBy: { id: 'asc' } });
    const preview = await getNoteSnapshotRestoreContext(snapshot.id);

    await assert.rejects(restoreNoteSnapshot(snapshot.id, { expectedUpdatedAt: moved.updatedAt.toISOString() }), {
        extensions: { code: 'SNAPSHOT_WORKSPACE_MISMATCH' },
    });
    const restored = await restoreNoteSnapshot(snapshot.id, {
        expectedUpdatedAt: moved.updatedAt.toISOString(),
        mappings: [{ sourceKey: originalField.key, targetKey: targetField.key }],
    });

    assert.equal(preview.sourceWorkspace.id, 1);
    assert.equal(preview.targetWorkspace.id, target.id);
    assert.equal(restored?.workspaceId, target.id);
    assert.equal((await listNoteProperties(note.id))[0].key, targetField.key);
});
