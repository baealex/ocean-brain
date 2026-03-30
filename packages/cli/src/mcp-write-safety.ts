import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { z } from 'zod';

export type McpWriteRisk = 'high-impact' | 'destructive';
export type McpWriteLogPhase = 'prepared' | 'confirmed' | 'executed' | 'failed' | 'rejected' | 'expired';

export const destructiveMcpWriteFields = {
    dryRun: z.boolean().optional().default(true)
        .describe('Preview the destructive change first. Set dryRun to false only after you receive an operationId and confirmToken.'),
    operationId: z.string().optional()
        .describe('Operation id returned by the dry-run response. Required when dryRun is false.'),
    confirmToken: z.string().optional()
        .describe('Confirmation token returned by the dry-run response. Required when dryRun is false.'),
    force: z.boolean().optional().default(false)
        .describe('Explicitly confirm a bulk destructive change when the preview says force is required.')
};

export interface DestructiveWriteRequest {
    dryRun?: boolean;
    operationId?: string;
    confirmToken?: string;
    force?: boolean;
}

export interface McpWriteSafetyOptions {
    now?: () => Date;
    randomBytes?: (size: number) => Buffer;
    rootDir?: string;
    ttlMs?: number;
}

export interface PrepareWriteOperationInput {
    actor: string;
    affectedIds: string[];
    estimatedChangeCount: number;
    force?: boolean;
    risk: McpWriteRisk;
    summary: string;
    toolName: string;
}

export interface PreparedWriteOperation {
    actor: string;
    affectedIds: string[];
    confirmToken: string;
    createdAt: string;
    estimatedChangeCount: number;
    expiresAt: string;
    force: boolean;
    operationId: string;
    risk: McpWriteRisk;
    summary: string;
    toolName: string;
}

export interface PendingWriteOperation {
    actor: string;
    affectedIds: string[];
    confirmTokenHash: string;
    createdAt: string;
    estimatedChangeCount: number;
    expiresAt: string;
    force: boolean;
    operationId: string;
    risk: McpWriteRisk;
    summary: string;
    toolName: string;
}

export interface PublicPendingWriteOperation {
    actor: string;
    affectedIds: string[];
    createdAt: string;
    estimatedChangeCount: number;
    expiresAt: string;
    force: boolean;
    operationId: string;
    risk: McpWriteRisk;
    summary: string;
    toolName: string;
}

export interface McpGraphqlErrorShape {
    message: string;
    extensions?: {
        code?: string;
        operationId?: string;
    };
}

export interface WriteOperationLogEntry {
    actor: string;
    affectedIds: string[];
    estimatedChangeCount: number;
    force: boolean;
    operationId: string;
    phase: McpWriteLogPhase;
    risk: McpWriteRisk;
    summary: string;
    timestamp: string;
    toolName: string;
    detail?: string;
}

export class McpCliWriteSafetyError extends Error {
    public readonly code: string;

    constructor(code: string, message: string) {
        super(message);
        this.name = 'McpCliWriteSafetyError';
        this.code = code;
    }
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_ROOT_DIR = path.resolve(os.homedir(), '.ocean-brain', 'mcp-write-safety');

const createError = (code: string, message: string) => new McpCliWriteSafetyError(code, message);

const ensureDirExists = (dirPath: string) => {
    fs.mkdirSync(dirPath, { recursive: true });
};

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const toPublicPendingOperation = (operation: PendingWriteOperation): PublicPendingWriteOperation => ({
    actor: operation.actor,
    affectedIds: operation.affectedIds,
    createdAt: operation.createdAt,
    estimatedChangeCount: operation.estimatedChangeCount,
    expiresAt: operation.expiresAt,
    force: operation.force,
    operationId: operation.operationId,
    risk: operation.risk,
    summary: operation.summary,
    toolName: operation.toolName
});

const parsePendingOperation = (raw: string) => JSON.parse(raw) as PendingWriteOperation;

export const defaultMcpWriteSafetyDir = () => {
    return path.resolve(process.env.OCEAN_BRAIN_MCP_WRITE_SAFETY_DIR || DEFAULT_ROOT_DIR);
};

export const formatMcpGraphqlError = (error: McpGraphqlErrorShape) => {
    const suffix: string[] = [];

    if (error.extensions?.code) {
        suffix.push(`code=${error.extensions.code}`);
    }

    if (error.extensions?.operationId) {
        suffix.push(`operationId=${error.extensions.operationId}`);
    }

    if (suffix.length === 0) {
        return `GraphQL error: ${error.message}`;
    }

    return `GraphQL error: ${error.message} (${suffix.join(', ')})`;
};

export const createMcpWriteSafetyCoordinator = (options: McpWriteSafetyOptions = {}) => {
    const rootDir = path.resolve(options.rootDir ?? defaultMcpWriteSafetyDir());
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    const now = options.now ?? (() => new Date());
    const randomBytes = options.randomBytes ?? ((size: number) => crypto.randomBytes(size));
    const pendingDir = path.resolve(rootDir, 'pending');
    const logPath = path.resolve(rootDir, 'operations.jsonl');

    const appendLog = (entry: WriteOperationLogEntry) => {
        ensureDirExists(rootDir);
        fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf-8');
    };

    const buildLogEntry = (
        operation: PublicPendingWriteOperation,
        phase: McpWriteLogPhase,
        detail?: string
    ): WriteOperationLogEntry => ({
        actor: operation.actor,
        affectedIds: operation.affectedIds,
        estimatedChangeCount: operation.estimatedChangeCount,
        force: operation.force,
        operationId: operation.operationId,
        phase,
        risk: operation.risk,
        summary: operation.summary,
        timestamp: now().toISOString(),
        toolName: operation.toolName,
        ...(detail ? { detail } : {})
    });

    const getPendingPath = (operationId: string) => path.resolve(pendingDir, `${operationId}.json`);

    const cleanupExpiredOperations = () => {
        if (!fs.existsSync(pendingDir)) {
            return;
        }

        for (const fileName of fs.readdirSync(pendingDir)) {
            const filePath = path.resolve(pendingDir, fileName);
            const pendingOperation = parsePendingOperation(fs.readFileSync(filePath, 'utf-8'));

            if (new Date(pendingOperation.expiresAt).getTime() > now().getTime()) {
                continue;
            }

            fs.rmSync(filePath, { force: true });
            appendLog(buildLogEntry(toPublicPendingOperation(pendingOperation), 'expired'));
        }
    };

    const listPendingOperations = () => {
        cleanupExpiredOperations();

        if (!fs.existsSync(pendingDir)) {
            return [];
        }

        return fs.readdirSync(pendingDir)
            .map((fileName) => path.resolve(pendingDir, fileName))
            .map((filePath) => parsePendingOperation(fs.readFileSync(filePath, 'utf-8')))
            .map(toPublicPendingOperation)
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    };

    const prepareOperation = (input: PrepareWriteOperationInput): PreparedWriteOperation => {
        ensureDirExists(pendingDir);

        const operationId = `mcpw_${randomBytes(8).toString('hex')}`;
        const confirmToken = `confirm_${randomBytes(12).toString('hex')}`;
        const currentTime = now();
        const createdAt = currentTime.toISOString();
        const expiresAt = new Date(currentTime.getTime() + ttlMs).toISOString();

        const pendingOperation: PendingWriteOperation = {
            actor: input.actor,
            affectedIds: input.affectedIds,
            confirmTokenHash: hashToken(confirmToken),
            createdAt,
            estimatedChangeCount: input.estimatedChangeCount,
            expiresAt,
            force: Boolean(input.force),
            operationId,
            risk: input.risk,
            summary: input.summary,
            toolName: input.toolName
        };

        fs.writeFileSync(getPendingPath(operationId), JSON.stringify(pendingOperation, null, 2), 'utf-8');
        appendLog(buildLogEntry(toPublicPendingOperation(pendingOperation), 'prepared'));

        return {
            ...toPublicPendingOperation(pendingOperation),
            confirmToken
        };
    };

    const requireConfirmedOperation = (
        request: DestructiveWriteRequest,
        expected: Pick<PrepareWriteOperationInput, 'toolName'>
    ): PublicPendingWriteOperation => {
        if (!request.operationId || !request.confirmToken) {
            throw createError(
                'CONFIRMATION_REQUIRED',
                'A destructive MCP write requires operationId and confirmToken after a dry run.'
            );
        }

        const pendingPath = getPendingPath(request.operationId);

        if (!fs.existsSync(pendingPath)) {
            throw createError('INVALID_CONFIRMATION', 'The write confirmation was not found or has already been consumed.');
        }

        const pendingOperation = parsePendingOperation(fs.readFileSync(pendingPath, 'utf-8'));
        const publicPendingOperation = toPublicPendingOperation(pendingOperation);

        if (new Date(pendingOperation.expiresAt).getTime() <= now().getTime()) {
            fs.rmSync(pendingPath, { force: true });
            appendLog(buildLogEntry(publicPendingOperation, 'expired'));
            throw createError('CONFIRMATION_EXPIRED', 'The write confirmation expired. Run dryRun again.');
        }

        if (pendingOperation.toolName !== expected.toolName) {
            appendLog(buildLogEntry(publicPendingOperation, 'rejected', 'tool_mismatch'));
            throw createError('INVALID_CONFIRMATION', 'The write confirmation does not match this MCP tool.');
        }

        if (pendingOperation.confirmTokenHash !== hashToken(request.confirmToken)) {
            appendLog(buildLogEntry(publicPendingOperation, 'rejected', 'token_mismatch'));
            throw createError('INVALID_CONFIRMATION', 'The write confirmation token is invalid.');
        }

        fs.rmSync(pendingPath, { force: true });
        appendLog(buildLogEntry(publicPendingOperation, 'confirmed'));
        return publicPendingOperation;
    };

    const ensureDestructiveWriteRequest = (
        request: DestructiveWriteRequest,
        input: PrepareWriteOperationInput
    ) => {
        if (request.dryRun ?? true) {
            return {
                kind: 'dry-run' as const,
                operation: prepareOperation({
                    ...input,
                    force: request.force ?? input.force
                })
            };
        }

        return {
            kind: 'confirmed' as const,
            operation: requireConfirmedOperation(request, { toolName: input.toolName })
        };
    };

    const recordWriteResult = (
        operation: PublicPendingWriteOperation,
        success: boolean,
        detail?: string
    ) => {
        appendLog(buildLogEntry(operation, success ? 'executed' : 'failed', detail));
    };

    const getStatus = () => {
        const pendingOperations = listPendingOperations();

        return {
            confirmationTtlMs: ttlMs,
            logPath,
            pendingDir,
            pendingOperationCount: pendingOperations.length,
            pendingOperations,
            rootDir,
            writeToolsEnabled: false
        };
    };

    return {
        ensureDestructiveWriteRequest,
        getStatus,
        listPendingOperations,
        prepareOperation,
        recordWriteResult,
        requireConfirmedOperation
    };
};

export const resolveCliMcpWriteIntent = (input: DestructiveWriteRequest) => {
    if (input.dryRun ?? true) {
        return { mode: 'dry-run' as const };
    }

    if (!input.operationId || !input.confirmToken) {
        throw createError(
            'CONFIRMATION_REQUIRED',
            'Commit mode requires both operationId and confirmToken from the dry-run response.'
        );
    }

    return {
        confirmToken: input.confirmToken,
        force: Boolean(input.force),
        mode: 'commit' as const,
        operationId: input.operationId
    };
};
