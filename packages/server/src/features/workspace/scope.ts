import models, { type Prisma } from '~/models.js';
import { AppError } from '~/modules/error-handler.js';

export const DEFAULT_WORKSPACE_ID = 1;
export type WorkspaceDb = typeof models | Prisma.TransactionClient;
export interface WorkspaceScopeInput {
    kind: 'all' | 'workspace';
    workspaceId?: string | number | null;
}

export class WorkspaceError extends AppError {
    extensions: { code: string };
    constructor(code: string, message: string) {
        super(400, code, message);
        this.extensions = { code };
    }
}

export const parseWorkspaceId = (value: unknown): number => {
    if ((typeof value !== 'string' && typeof value !== 'number') || !/^[1-9]\d*$/.test(String(value))) {
        throw new WorkspaceError('INVALID_WORKSPACE_ID', 'Choose a valid workspace.');
    }
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id > 2_147_483_647) {
        throw new WorkspaceError('INVALID_WORKSPACE_ID', 'Choose a valid workspace.');
    }
    return id;
};

export const normalizeWorkspaceScope = (value?: WorkspaceScopeInput | null): number | null => {
    if (value === undefined || value === null) return null;
    if (value.kind === 'all' && value.workspaceId == null) return null;
    if (value.kind === 'workspace' && value.workspaceId != null) return parseWorkspaceId(value.workspaceId);
    throw new WorkspaceError('INVALID_WORKSPACE_SCOPE', 'Choose all notes or one workspace.');
};

export const requireWorkspace = async (id: unknown, db: WorkspaceDb = models, writable = false) => {
    const workspace = await db.workspace.findUnique({ where: { id: parseWorkspaceId(id) } });
    if (!workspace) throw new WorkspaceError('WORKSPACE_NOT_FOUND', 'This workspace no longer exists.');
    if (writable && workspace.archivedAt) {
        throw new WorkspaceError(
            'WORKSPACE_ARCHIVED',
            'Unarchive this workspace before changing its notes or settings.',
        );
    }
    return workspace;
};

export const resolveWorkspaceWhere = async (scope?: WorkspaceScopeInput | null, db: WorkspaceDb = models) => {
    const workspaceId = normalizeWorkspaceScope(scope);
    if (workspaceId === null) return {};
    await requireWorkspace(workspaceId, db);
    return { workspaceId };
};

export const assertSameWorkspace = (actual: number, expected: number) => {
    if (actual !== expected) {
        throw new WorkspaceError(
            'WORKSPACE_MISMATCH',
            'This item belongs to a different workspace. Choose an item from the current workspace.',
        );
    }
};

export const parseWorkspaceScope = (value: unknown): WorkspaceScopeInput | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'object' || !('kind' in value))
        throw new WorkspaceError('INVALID_WORKSPACE_SCOPE', 'Choose all notes or one workspace.');
    const workspaceId = 'workspaceId' in value ? value.workspaceId : undefined;
    if (value.kind === 'all' && workspaceId == null) return { kind: 'all' };
    if (value.kind === 'workspace') return { kind: 'workspace', workspaceId: parseWorkspaceId(workspaceId) };
    throw new WorkspaceError('INVALID_WORKSPACE_SCOPE', 'Choose all notes or one workspace.');
};

export const requireWritableNote = async (id: number, db: WorkspaceDb = models) => {
    const note = await db.note.findUniqueOrThrow({ where: { id } });
    await requireWorkspace(note.workspaceId, db, true);
    return note;
};

export const resolvedWorkspaceScope = (where: { workspaceId?: number }) =>
    where.workspaceId === undefined
        ? { kind: 'all' as const, workspaceId: null }
        : { kind: 'workspace' as const, workspaceId: String(where.workspaceId) };
