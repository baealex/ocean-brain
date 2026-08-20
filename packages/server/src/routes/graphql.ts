import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import mercurius from 'mercurius';
import type { McpAdminService } from '../features/mcp-admin/service.js';
import { createCsrfProtection, isAuthenticatedRequest, requireSessionForGraphql } from '../modules/auth-guard.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import { createMcpAuthMiddleware, createReadOnlyMcpValidationRule } from '../modules/mcp-auth.js';
import schema from '../schema/index.js';

type McpGraphqlService = Pick<McpAdminService, 'getStatus' | 'validatePresentedToken'>;

const createGraphqlContext = (authConfig: AuthConfig) => (request: FastifyRequest, reply: FastifyReply) => ({
    authMode: authConfig.mode,
    isAuthenticated: isAuthenticatedRequest(request),
    req: request,
    res: reply,
});

export const createGraphqlRouter = (authConfig: AuthConfig, mcpAdminService: McpGraphqlService): FastifyPluginAsync => {
    return async (app) => {
        app.register(async (mcpEndpoint) => {
            mcpEndpoint.addHook('preHandler', createMcpAuthMiddleware(authConfig, mcpAdminService));
            mcpEndpoint.register(mercurius, {
                schema,
                path: '/graphql/mcp',
                graphiql: false,
                errorFormatter: (execution, context) => ({
                    ...mercurius.defaultErrorFormatter(execution, context),
                    statusCode: 200,
                }),
                context: createGraphqlContext(authConfig),
                validationRules: [createReadOnlyMcpValidationRule()],
            });
        });

        app.register(async (sessionEndpoint) => {
            sessionEndpoint.addHook('preHandler', requireSessionForGraphql(authConfig));
            sessionEndpoint.addHook('preHandler', createCsrfProtection(authConfig));
            sessionEndpoint.register(mercurius, {
                schema,
                path: '/graphql',
                graphiql: false,
                errorHandler: false,
                context: createGraphqlContext(authConfig),
            });
        });
    };
};
