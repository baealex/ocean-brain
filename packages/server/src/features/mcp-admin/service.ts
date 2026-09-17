import { type IntegrationPermission, MCP_CONNECTION_ID } from '../integration/manifest.js';
import { createIntegrationService, type IntegrationService } from '../integration/service.js';

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

export type McpTokenValidationResult =
    | { ok: true; permissions: IntegrationPermission[] }
    | { ok: false; reason: 'not_configured' | 'forbidden' };

export interface McpAdminService {
    getStatus: () => Promise<McpAdminStatus>;
    setEnabled: (enabled: boolean) => Promise<void>;
    rotateToken: () => Promise<{ token: string }>;
    revokeActiveToken: () => Promise<void>;
    validatePresentedToken: (token: string) => Promise<McpTokenValidationResult>;
}

// Compatibility facade: MCP administration and integration settings share one authority.
export const createMcpAdminService = (
    integrations: IntegrationService = createIntegrationService(),
): McpAdminService => ({
    async getStatus() {
        const integration = await integrations.get(MCP_CONNECTION_ID);
        return { enabled: integration.enabled, hasActiveToken: integration.token !== null, token: integration.token };
    },
    async setEnabled(enabled) {
        await integrations.update(MCP_CONNECTION_ID, { enabled });
    },
    rotateToken: () => integrations.rotateToken(MCP_CONNECTION_ID),
    revokeActiveToken: () => integrations.revokeToken(MCP_CONNECTION_ID),
    async validatePresentedToken(token) {
        const integration = await integrations.get(MCP_CONNECTION_ID);
        if (!integration.token) return { ok: false, reason: 'not_configured' };
        const principal = await integrations.authenticate(token);
        if (!principal || principal.connectionId !== MCP_CONNECTION_ID) return { ok: false, reason: 'forbidden' };
        return { ok: true, permissions: principal.permissions };
    },
});
