import models from '~/models.js';
import { DEFAULT_WORKSPACE_ID, parseWorkspaceId, requireWorkspace, WorkspaceError } from './scope.js';

const normalizeName = (value: string) => {
    const name = value.trim();
    if (!name || name.length > 80)
        throw new WorkspaceError('INVALID_WORKSPACE_NAME', 'Use a workspace name between 1 and 80 characters.');
    return name;
};

const workspaceOrder = [{ order: 'asc' as const }, { createdAt: 'asc' as const }, { id: 'asc' as const }];

export const listWorkspaces = () => models.workspace.findMany({ orderBy: workspaceOrder });

export const createWorkspace = (name: string) =>
    models.$transaction(async (tx) => {
        const last = await tx.workspace.aggregate({ _max: { order: true } });
        const workspace = await tx.workspace.create({
            data: { name: normalizeName(name), order: (last._max.order ?? -1) + 1 },
        });
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

export const reorderWorkspaces = (ids: string[]) =>
    models.$transaction(async (tx) => {
        const nextIds = ids.map(parseWorkspaceId);
        const currentIds = new Set((await tx.workspace.findMany({ select: { id: true } })).map(({ id }) => id));
        if (
            nextIds.length !== currentIds.size ||
            new Set(nextIds).size !== nextIds.length ||
            !nextIds.every((id) => currentIds.has(id))
        ) {
            throw new WorkspaceError('INVALID_WORKSPACE_ORDER', 'Include every workspace exactly once.');
        }
        await Promise.all(nextIds.map((id, order) => tx.workspace.update({ where: { id }, data: { order } })));
        return tx.workspace.findMany({ orderBy: workspaceOrder });
    });
