import type { Note } from '~/models/note.model';
import type { PropertyWorkspaceMapping, Workspace, WorkspaceMovePreview } from '~/models/workspace.model';
import { graphQuery } from '~/modules/graph-query';

export const fetchWorkspaces = () =>
    graphQuery<{ workspaces: Workspace[] }>(`query FetchWorkspaces {
    workspaces { id name archivedAt createdAt updatedAt }
}`);

export const createWorkspace = (name: string) =>
    graphQuery<{ createWorkspace: Workspace }>(
        `mutation CreateWorkspace($name: String!) {
    createWorkspace(name: $name) { id name archivedAt createdAt updatedAt }
}`,
        { name },
    );

export const updateWorkspace = (id: string, input: { name?: string; archived?: boolean }) =>
    graphQuery<{ updateWorkspace: Workspace }>(
        `mutation UpdateWorkspace($id: ID!, $input: WorkspaceUpdateInput!) {
    updateWorkspace(id: $id, input: $input) { id name archivedAt createdAt updatedAt }
}`,
        { id, input },
    );

export const fetchNoteWorkspaceMovePreview = (id: string, targetWorkspaceId: string) =>
    graphQuery<{ previewNoteWorkspaceMove: WorkspaceMovePreview }>(
        `query PreviewNoteWorkspaceMove($id: ID!, $targetWorkspaceId: ID!) {
    previewNoteWorkspaceMove(id: $id, targetWorkspaceId: $targetWorkspaceId) {
        noteId expectedUpdatedAt
        sourceWorkspace { id name archivedAt createdAt updatedAt }
        targetWorkspace { id name archivedAt createdAt updatedAt }
        sourceProperties { key name value valueType createdAt updatedAt }
        targetProperties { key name valueType options { id value label } }
        templateViews { id title }
    }
}`,
        { id, targetWorkspaceId },
    );

export const fetchNoteSnapshotRestoreContext = (id: string) =>
    graphQuery<{ noteSnapshotRestoreContext: WorkspaceMovePreview }>(
        `query NoteSnapshotRestoreContext($id: ID!) {
    noteSnapshotRestoreContext(id: $id) {
        noteId expectedUpdatedAt
        sourceWorkspace { id name archivedAt createdAt updatedAt }
        targetWorkspace { id name archivedAt createdAt updatedAt }
        sourceProperties { key name value valueType createdAt updatedAt }
        targetProperties { key name valueType options { id value label } }
        templateViews { id title }
    }
}`,
        { id },
    );

export const moveNoteToWorkspace = (input: {
    id: string;
    targetWorkspaceId: string;
    expectedUpdatedAt: string;
    mappings: PropertyWorkspaceMapping[];
}) =>
    graphQuery<{ moveNoteToWorkspace: Note }>(
        `mutation MoveNoteToWorkspace($id: ID!, $targetWorkspaceId: ID!, $expectedUpdatedAt: String!, $mappings: [PropertyWorkspaceMappingInput!]!) {
    moveNoteToWorkspace(id: $id, targetWorkspaceId: $targetWorkspaceId, expectedUpdatedAt: $expectedUpdatedAt, mappings: $mappings) {
        id workspaceId title content pinned order layout createdAt updatedAt
        tags { id name }
        properties { key name value valueType option { id label value color order } createdAt updatedAt }
    }
}`,
        input,
    );
