import models from '~/models.js';
import { issueMcpToken, verifyMcpToken } from './mcp-token.js';

const MCP_ENABLED_CACHE_KEY = 'MCP_ENABLED';

export interface McpTokenSummary {
    id: string;
    createdAt: string;
    lastUsedAt: string | null;
}

export interface McpAdminStatus {
    enabled: boolean;
    hasActiveToken: boolean;
    token: McpTokenSummary | null;
}

export interface McpTokenValidationResult {
    ok: boolean;
    reason?: 'not_configured' | 'forbidden';
}

export interface McpAdminService {
    getStatus: () => Promise<McpAdminStatus>;
    setEnabled: (enabled: boolean) => Promise<void>;
    rotateToken: () => Promise<{ token: string }>;
    revokeActiveToken: () => Promise<void>;
    validatePresentedToken: (token: string) => Promise<McpTokenValidationResult>;
}

interface McpAdminDb {
    cache: {
        findUnique: (args: { where: { key: string } }) => Promise<{ value: string } | null>;
        upsert: (args: {
            where: { key: string };
            update: { value: string };
            create: { key: string; value: string };
        }) => Promise<unknown>;
    };
    mcpToken: {
        findFirst: (args: { where: { revokedAt: Date | null }; orderBy: { createdAt: 'desc' | 'asc' } }) => Promise<{
            id: number;
            tokenHash: string;
            createdAt: Date;
            lastUsedAt: Date | null;
            revokedAt: Date | null;
        } | null>;
        updateMany: (args: {
            where: { revokedAt: Date | null };
            data: { revokedAt: Date };
        }) => Promise<{ count: number }>;
        create: (args: { data: { tokenHash: string } }) => Promise<unknown>;
        update: (args: { where: { id: number }; data: { lastUsedAt: Date } }) => Promise<unknown>;
    };
    $transaction: <T>(callback: (tx: McpAdminDb) => Promise<T>) => Promise<T>;
}

const toStatus = (
    enabled: boolean,
    activeToken: {
        id: number;
        createdAt: Date;
        lastUsedAt: Date | null;
    } | null,
): McpAdminStatus => {
    if (!activeToken) {
        return {
            enabled,
            hasActiveToken: false,
            token: null,
        };
    }

    return {
        enabled,
        hasActiveToken: true,
        token: {
            id: String(activeToken.id),
            createdAt: activeToken.createdAt.toISOString(),
            lastUsedAt: activeToken.lastUsedAt ? activeToken.lastUsedAt.toISOString() : null,
        },
    };
};

export const createMcpAdminService = (db: McpAdminDb = models as unknown as McpAdminDb): McpAdminService => {
    return {
        async getStatus() {
            const enabledCache = await db.cache.findUnique({ where: { key: MCP_ENABLED_CACHE_KEY } });
            const activeToken = await db.mcpToken.findFirst({
                where: { revokedAt: null },
                orderBy: { createdAt: 'desc' },
            });

            return toStatus(enabledCache?.value === 'true', activeToken);
        },
        async setEnabled(enabled) {
            await db.cache.upsert({
                where: { key: MCP_ENABLED_CACHE_KEY },
                update: { value: String(enabled) },
                create: {
                    key: MCP_ENABLED_CACHE_KEY,
                    value: String(enabled),
                },
            });
        },
        async rotateToken() {
            const now = new Date();
            const issued = issueMcpToken();

            await db.$transaction(async (transaction) => {
                await transaction.mcpToken.updateMany({
                    where: { revokedAt: null },
                    data: { revokedAt: now },
                });
                await transaction.mcpToken.create({ data: { tokenHash: issued.hash } });
            });

            return { token: issued.plaintext };
        },
        async revokeActiveToken() {
            await db.mcpToken.updateMany({
                where: { revokedAt: null },
                data: { revokedAt: new Date() },
            });
        },
        async validatePresentedToken(token) {
            const activeToken = await db.mcpToken.findFirst({
                where: { revokedAt: null },
                orderBy: { createdAt: 'desc' },
            });

            if (!activeToken) {
                return {
                    ok: false,
                    reason: 'not_configured',
                };
            }

            if (!verifyMcpToken(activeToken.tokenHash, token)) {
                return {
                    ok: false,
                    reason: 'forbidden',
                };
            }

            await db.mcpToken.update({
                where: { id: activeToken.id },
                data: { lastUsedAt: new Date() },
            });

            return { ok: true };
        },
    };
};
