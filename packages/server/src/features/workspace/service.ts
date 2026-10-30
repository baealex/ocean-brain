import models from '~/models.js';
import { DEFAULT_WORKSPACE_ID, parseWorkspaceId, requireWorkspace, WorkspaceError } from './scope.js';

const normalizeName = (value: string) => {
    const name = value.trim();
    if (!name || name.length > 80)
        throw new WorkspaceError('INVALID_WORKSPACE_NAME', 'Use a workspace name between 1 and 80 characters.');
    return name;
};

export const listWorkspaces = () => models.workspace.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });

export const createWorkspace = (name: string) =>
    models.$transaction(async (tx) => {
        const workspace = await tx.workspace.create({ data: { name: normalizeName(name) } });
        await tx.viewDashboardState.create({ data: { workspaceId: workspace.id } });
        return workspace;
    });

export const updateWorkspace = (id: string, input: { name?: string; archived?: boolean }) =>
    models.$transaction(async (tx) => {
        const workspaceId = parseWorkspaceId(id);
        await requireWorkspace(workspaceId, tx);
        if (input.archived && workspaceId === DEFAULT_WORKSPACE_ID) {
            throw new WorkspaceError(
                'DEFAULT_WORKSPACE_REQUIRED',
                'The default workspace stays available for quick capture and existing connections.',
            );
        }
        return tx.workspace.update({
            where: { id: workspaceId },
            data: {
                ...(input.name !== undefined ? { name: normalizeName(input.name) } : {}),
                ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
            },
        });
    });
