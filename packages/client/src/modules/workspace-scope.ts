import type { WorkspaceScope } from '~/models/workspace.model';

export const DEFAULT_WORKSPACE_ID = '1';

export const validateWorkspaceId = (value: unknown): string => {
    if (
        (typeof value !== 'string' && typeof value !== 'number') ||
        !/^[1-9]\d*$/.test(String(value)) ||
        Number(value) > 2_147_483_647
    ) {
        throw new Error('This workspace address is invalid. Open Settings to choose another workspace.');
    }
    return String(value);
};

export const workspaceScope = (id: string): WorkspaceScope => ({
    kind: 'workspace',
    workspaceId: validateWorkspaceId(id),
});

export const validateWorkspaceSearch = (
    search: Record<string, unknown>,
): { workspace?: string; scopeWorkspace?: string } => ({
    ...(search.workspace !== undefined ? { workspace: validateWorkspaceId(search.workspace) } : {}),
    ...(search.scopeWorkspace !== undefined
        ? { scopeWorkspace: search.scopeWorkspace === 'all' ? 'all' : validateWorkspaceId(search.scopeWorkspace) }
        : {}),
});

export const scopeFromSearch = (value?: string, fallback: WorkspaceScope = { kind: 'all' }): WorkspaceScope =>
    value === undefined ? fallback : value === 'all' ? { kind: 'all' } : workspaceScope(value);
