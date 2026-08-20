import { getOceanBrainVersionInfo } from '~/modules/app-version.js';
import { createAppError } from '~/modules/error-handler.js';
import type { Controller } from '~/types/index.js';
import { createMcpAdminService, type McpAdminService } from '../service.js';

type McpAdminControllerService = Pick<
    McpAdminService,
    'getStatus' | 'setEnabled' | 'rotateToken' | 'revokeActiveToken'
>;

const createMcpAdminStatusResponse = async (service: McpAdminControllerService) => {
    const status = await service.getStatus();

    return {
        ...status,
        server: getOceanBrainVersionInfo(),
    };
};

export const createMcpAdminStatusHandler = (
    service: McpAdminControllerService = createMcpAdminService(),
): Controller => {
    return async (_req, reply) => {
        const status = await createMcpAdminStatusResponse(service);
        return reply.status(200).send(status);
    };
};

export const createMcpAdminSetEnabledHandler = (
    service: McpAdminControllerService = createMcpAdminService(),
): Controller => {
    return async (req, reply) => {
        const enabled = req.body?.enabled;
        if (typeof enabled !== 'boolean') {
            throw createAppError(400, 'INVALID_MCP_ENABLED', 'enabled must be a boolean.');
        }

        await service.setEnabled(enabled);
        const status = await createMcpAdminStatusResponse(service);
        return reply.status(200).send(status);
    };
};

export const createMcpAdminRotateTokenHandler = (
    service: McpAdminControllerService = createMcpAdminService(),
): Controller => {
    return async (_req, reply) => {
        const result = await service.rotateToken();
        return reply.status(200).send({
            token: result.token,
            message: 'Save this token now. It is shown only once.',
        });
    };
};

export const createMcpAdminRevokeTokenHandler = (
    service: McpAdminControllerService = createMcpAdminService(),
): Controller => {
    return async (_req, reply) => {
        await service.revokeActiveToken();
        const status = await createMcpAdminStatusResponse(service);
        return reply.status(200).send(status);
    };
};
