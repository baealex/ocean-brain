import { createAppError } from '~/modules/error-handler.js';
import { createMcpAdminService, type McpAdminService } from '~/modules/mcp-admin.js';
import type { Controller } from '~/types/index.js';

type McpAdminControllerService = Pick<
McpAdminService,
'getStatus' | 'setEnabled' | 'rotateToken' | 'revokeActiveToken'
>;

export const createMcpAdminStatusHandler = (
    service: McpAdminControllerService = createMcpAdminService()
): Controller => {
    return async (_req, res) => {
        const status = await service.getStatus();
        res.status(200).json(status).end();
    };
};

export const createMcpAdminSetEnabledHandler = (
    service: McpAdminControllerService = createMcpAdminService()
): Controller => {
    return async (req, res) => {
        const enabled = req.body?.enabled;
        if (typeof enabled !== 'boolean') {
            throw createAppError(400, 'INVALID_MCP_ENABLED', 'enabled must be a boolean.');
        }

        await service.setEnabled(enabled);
        const status = await service.getStatus();
        res.status(200).json(status).end();
    };
};

export const createMcpAdminRotateTokenHandler = (
    service: McpAdminControllerService = createMcpAdminService()
): Controller => {
    return async (_req, res) => {
        const result = await service.rotateToken();
        res.status(200).json({
            token: result.token,
            message: 'Save this token now. It is shown only once.'
        }).end();
    };
};

export const createMcpAdminRevokeTokenHandler = (
    service: McpAdminControllerService = createMcpAdminService()
): Controller => {
    return async (_req, res) => {
        await service.revokeActiveToken();
        const status = await service.getStatus();
        res.status(200).json(status).end();
    };
};
