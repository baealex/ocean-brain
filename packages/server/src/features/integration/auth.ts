import type { preHandlerAsyncHookHandler } from 'fastify';
import { enforceMcpCompatibility } from '~/modules/mcp-auth.js';
import type { IntegrationPermission } from './manifest.js';
import { createIntegrationService, type IntegrationService } from './service.js';

export const requireIntegrationPermission =
    (
        permission: IntegrationPermission,
        service: IntegrationService = createIntegrationService(),
    ): preHandlerAsyncHookHandler =>
    async (request, reply) => {
        const header = request.headers.authorization;
        if (!header?.startsWith('Bearer ') || header.length > 1024) {
            return reply
                .status(401)
                .send({ code: 'UNAUTHORIZED', message: 'An integration bearer token is required.' });
        }
        const principal = await service.authenticate(header.slice(7).trim());
        if (!principal)
            return reply.status(403).send({
                code: 'INTEGRATION_ACCESS_DENIED',
                message: 'The integration token is invalid, revoked, or disabled.',
            });
        if (!principal.permissions.includes(permission))
            return reply
                .status(403)
                .send({ code: 'INTEGRATION_PERMISSION_DENIED', message: `Permission required: ${permission}` });
        request.integration = principal;
        if (principal.native && principal.connectionId === 'mcp') await enforceMcpCompatibility(request, reply);
    };
