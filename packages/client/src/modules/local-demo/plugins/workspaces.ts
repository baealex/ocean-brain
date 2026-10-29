import type { NoteProperty } from '~/models/note.model';
import type { PropertyWorkspaceMapping } from '~/models/workspace.model';
import { localError, success } from '../response';
import type { LocalDemoPlugin, LocalDemoState } from '../types';
import { now } from '../utils';
import { localWorkspace } from '../workspace';

const normalizeName = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 80)
        throw new Error('Use a workspace name between 1 and 80 characters.');
    return value.trim();
};

const preview = (state: LocalDemoState, id: string, target: string) => {
    const note = state.notes.find((note) => note.id === id);
    if (!note) throw new Error('Note not found.');
    const source = localWorkspace(state, note.workspaceId ?? '1', true);
    localWorkspace(state, target, true);
    if (source === target) throw new Error('Choose another workspace.');
    return {
        noteId: id,
        expectedUpdatedAt: note.updatedAt,
        sourceWorkspace: state.workspaces.find((workspace) => workspace.id === source),
        targetWorkspace: state.workspaces.find((workspace) => workspace.id === target),
        sourceProperties: note.properties ?? [],
        targetProperties: state.propertyDefinitions.filter((definition) => (definition.workspaceId ?? '1') === target),
        templateViews: state.viewWorkspace.groups
            .flatMap((group) => group.views)
            .filter((view) => view.defaultTemplateNoteId === id)
            .map((view) => ({ id: view.id, title: view.title })),
    };
};

export const workspacesLocalPlugin: LocalDemoPlugin = {
    name: 'workspaces',
    graphHandlers: {
        FetchWorkspaces: ({ state }) => success({ workspaces: state.workspaces }),
        CreateWorkspace: ({ state, variables, save }) => {
            const name = normalizeName(variables.name);
            const id = String(Math.max(...state.workspaces.map((workspace) => Number(workspace.id))) + 1);
            const timestamp = new Date().toISOString();
            const workspace = { id, name, archivedAt: null, createdAt: timestamp, updatedAt: timestamp };
            state.workspaces.push(workspace);
            save();
            return success({ createWorkspace: workspace });
        },
        UpdateWorkspace: ({ state, variables, save }) => {
            const id = localWorkspace(state, variables.id);
            const workspace = state.workspaces.find((workspace) => workspace.id === id);
            const input = variables.input;
            if (!workspace || typeof input !== 'object' || input === null)
                return localError('Choose a workspace to update.');
            const name = 'name' in input && input.name !== undefined ? normalizeName(input.name) : workspace.name;
            const archived = 'archived' in input ? input.archived : undefined;
            if (archived !== undefined && typeof archived !== 'boolean')
                return localError('Choose archive or unarchive.');
            if (id === '1' && archived) return localError('The default workspace stays available for quick capture.');
            workspace.name = name;
            if (archived !== undefined) workspace.archivedAt = archived ? new Date().toISOString() : null;
            workspace.updatedAt = new Date().toISOString();
            save();
            return success({ updateWorkspace: workspace });
        },
        PreviewNoteWorkspaceMove: ({ state, variables }) =>
            success({
                previewNoteWorkspaceMove: preview(state, String(variables.id), String(variables.targetWorkspaceId)),
            }),
        MoveNoteToWorkspace: ({ state, variables, save }) => {
            const data = preview(state, String(variables.id), String(variables.targetWorkspaceId));
            if (variables.expectedUpdatedAt !== data.expectedUpdatedAt)
                return localError('This note changed. Reload it before moving.');
            if (data.templateViews.length)
                return localError('Remove this note from default templates before moving it.');
            if (!Array.isArray(variables.mappings)) return localError('Map each property before moving this note.');
            const mappings: PropertyWorkspaceMapping[] = variables.mappings.map((value) => {
                if (
                    typeof value !== 'object' ||
                    value === null ||
                    !('sourceKey' in value) ||
                    !('targetKey' in value) ||
                    typeof value.sourceKey !== 'string' ||
                    typeof value.targetKey !== 'string'
                )
                    throw new Error('Choose a source and destination field.');
                return { sourceKey: value.sourceKey, targetKey: value.targetKey };
            });
            if (
                mappings.length !== data.sourceProperties.length ||
                new Set(mappings.map((mapping) => mapping.targetKey)).size !== mappings.length ||
                new Set(mappings.map((mapping) => mapping.sourceKey)).size !== mappings.length
            )
                return localError('Map every property to a different destination field.');
            const properties: NoteProperty[] = data.sourceProperties.map((property) => {
                const mapping = mappings.find((mapping) => mapping.sourceKey === property.key);
                const target = data.targetProperties.find((definition) => definition.key === mapping?.targetKey);
                if (!target || target.valueType !== property.valueType)
                    throw new Error(`Choose a compatible field for ${property.name}.`);
                const option = target.options.find((option) => option.value === property.value);
                if (target.valueType === 'select' && !option)
                    throw new Error(`Add the matching option for ${property.name} in the destination workspace first.`);
                return { ...property, key: target.key, name: target.name, option: option ?? null, updatedAt: now() };
            });
            const note = state.notes.find((note) => note.id === data.noteId);
            if (!note) return localError('Note not found.');
            note.workspaceId = String(variables.targetWorkspaceId);
            note.properties = properties;
            note.updatedAt = String(Math.max(Date.now(), Number(note.updatedAt) + 1 || Date.parse(note.updatedAt) + 1));
            save();
            return success({ moveNoteToWorkspace: note });
        },
        NoteSnapshotRestoreContext: () => localError('Snapshots are not available in local-only demo mode.'),
    },
};
