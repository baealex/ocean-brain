import type { NoteProperty, NotePropertyValueType } from './note.model';

export interface Workspace {
    id: string;
    name: string;
    archivedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export type WorkspaceScope = { kind: 'all' } | { kind: 'workspace'; workspaceId: string };
export interface PropertyWorkspaceMapping {
    sourceKey: string;
    targetKey: string;
}
export interface WorkspaceMovePreview {
    noteId: string;
    expectedUpdatedAt: string;
    sourceWorkspace: Workspace;
    targetWorkspace: Workspace;
    sourceProperties: NoteProperty[];
    targetProperties: Array<{
        key: string;
        name: string;
        valueType: NotePropertyValueType;
        options: Array<{ id: string; value: string; label: string }>;
    }>;
    templateViews: Array<{ id: string; title: string }>;
}
