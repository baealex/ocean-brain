import type { IResolvers } from '@graphql-tools/utils';
import { GraphQLError } from 'graphql';
import { getNoteSnapshotRestoreContext } from '~/features/note/services/snapshot.js';
import { isNoteVersionConflictError } from '~/features/note/services/write-conflict.js';
import { moveNoteToWorkspace, type PropertyWorkspaceMapping, previewNoteWorkspaceMove } from './move.js';
import { requireWorkspace } from './scope.js';
import { createWorkspace, listWorkspaces, updateWorkspace } from './service.js';

export const workspaceTypeDefs = `
    enum WorkspaceScopeKind { all workspace }
    input WorkspaceScopeInput { kind: WorkspaceScopeKind!, workspaceId: ID }
    type WorkspaceReadScope { kind: WorkspaceScopeKind!, workspaceId: ID }
    type Workspace { id: ID!, name: String!, archivedAt: String, createdAt: String!, updatedAt: String! }
    input WorkspaceUpdateInput { name: String, archived: Boolean }
    input PropertyWorkspaceMappingInput { sourceKey: String!, targetKey: String! }
    type WorkspaceMoveTemplateView { id: ID!, title: String! }
    type WorkspaceMovePreview {
        noteId: ID!, expectedUpdatedAt: String!, sourceWorkspace: Workspace!, targetWorkspace: Workspace!
        sourceProperties: [NoteProperty!]!, targetProperties: [NotePropertyKey!]!
        templateViews: [WorkspaceMoveTemplateView!]!
    }
    extend type Query {
        workspaces: [Workspace!]!
        noteSnapshotRestoreContext(id: ID!): WorkspaceMovePreview!
        previewNoteWorkspaceMove(id: ID!, targetWorkspaceId: ID!): WorkspaceMovePreview!
    }
    extend type Mutation {
        createWorkspace(name: String!): Workspace!
        updateWorkspace(id: ID!, input: WorkspaceUpdateInput!): Workspace!
        moveNoteToWorkspace(id: ID!, targetWorkspaceId: ID!, expectedUpdatedAt: String!, mappings: [PropertyWorkspaceMappingInput!]!): Note!
    }
`;

export const workspaceResolvers: IResolvers = {
    Query: {
        workspaces: () => listWorkspaces(),
        noteSnapshotRestoreContext: (_, { id }: { id: string }) => getNoteSnapshotRestoreContext(Number(id)),
        previewNoteWorkspaceMove: (_, { id, targetWorkspaceId }: { id: string; targetWorkspaceId: string }) =>
            previewNoteWorkspaceMove(id, targetWorkspaceId),
    },
    Mutation: {
        createWorkspace: (_, { name }: { name: string }) => createWorkspace(name),
        updateWorkspace: (_, { id, input }: { id: string; input: { name?: string; archived?: boolean } }) =>
            updateWorkspace(id, input),
        moveNoteToWorkspace: async (
            _,
            input: {
                id: string;
                targetWorkspaceId: string;
                expectedUpdatedAt: string;
                mappings: PropertyWorkspaceMapping[];
            },
        ) => {
            try {
                return await moveNoteToWorkspace(input);
            } catch (error) {
                if (isNoteVersionConflictError(error))
                    throw new GraphQLError(error.message, {
                        extensions: {
                            code: error.code,
                            currentUpdatedAt: error.currentUpdatedAt,
                            expectedUpdatedAt: error.expectedUpdatedAt,
                        },
                    });
                throw error;
            }
        },
    },
    Note: { workspace: (note: { workspaceId: number }) => requireWorkspace(note.workspaceId) },
    Workspace: {
        archivedAt: (workspace: { archivedAt: Date | null }) => workspace.archivedAt?.toISOString() ?? null,
        createdAt: (workspace: { createdAt: Date }) => workspace.createdAt.toISOString(),
        updatedAt: (workspace: { updatedAt: Date }) => workspace.updatedAt.toISOString(),
    },
};
