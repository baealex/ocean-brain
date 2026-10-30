import type { Note } from '~/models/note.model';
import { validateWorkspaceId } from '../workspace-scope';
import type { LocalDemoState, LocalGraphVariables } from './types';

export const localWorkspace = (state: LocalDemoState, value: unknown, writable = false) => {
    const id = validateWorkspaceId(value);
    const workspace = state.workspaces?.find((workspace) => workspace.id === id);
    if (!workspace && (state.workspaces || id !== '1')) throw new Error('This workspace no longer exists.');
    if (writable && workspace?.archivedAt)
        throw new Error('Unarchive this workspace before changing its notes or settings.');
    return id;
};

export const localScopeId = (state: LocalDemoState, variables: LocalGraphVariables): string | null => {
    const scope = variables.scope;
    if (scope == null) return null;
    if (typeof scope !== 'object' || !('kind' in scope)) throw new Error('Choose all notes or one workspace.');
    const id = 'workspaceId' in scope ? scope.workspaceId : undefined;
    if (scope.kind === 'all' && id == null) return null;
    if (scope.kind === 'workspace') return localWorkspace(state, id);
    throw new Error('Choose all notes or one workspace.');
};

export const localScopedNotes = (state: LocalDemoState, variables: LocalGraphVariables): Note[] => {
    const id = localScopeId(state, variables);
    return id === null ? state.notes : state.notes.filter((note) => (note.workspaceId ?? '1') === id);
};

export const localViewWorkspace = (state: LocalDemoState, value: unknown = '1') => {
    const id = localWorkspace(state, value);
    const groups = state.viewWorkspace.groups
        .filter((group) => (group.workspaceId ?? '1') === id)
        .sort((a, b) => a.order - b.order);
    const selected = state.viewActiveGroupIds?.[id] ?? (id === '1' ? state.viewWorkspace.activeGroupId : null);
    return {
        groups,
        activeGroupId: groups.some((group) => group.id === selected) ? selected : (groups[0]?.id ?? null),
    };
};

export const localViewNotes = (state: LocalDemoState, workspaceId: string | undefined) => ({
    ...state,
    notes: state.notes.filter((note) => (note.workspaceId ?? '1') === (workspaceId ?? '1')),
});
