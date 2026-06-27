import { type Request, type Response, Router } from 'express';
import { createHandler } from 'graphql-http/lib/use/express';
import type { McpAdminService } from '../features/mcp-admin/service.js';
import { createCsrfProtection, isAuthenticatedRequest, requireSessionForGraphql } from '../modules/auth-guard.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import { createMcpAuthMiddleware, createReadOnlyMcpValidationRule } from '../modules/mcp-auth.js';
import schema from '../schema/index.js';

type McpGraphqlService = Pick<McpAdminService, 'getStatus' | 'validatePresentedToken'>;
type GraphqlRequestContext = { raw: Request; context: { res: Response } };

const createGraphqlContext = (authConfig: AuthConfig) => (req: GraphqlRequestContext) => ({
    authMode: authConfig.mode,
    isAuthenticated: isAuthenticatedRequest(req.raw),
    req: req.raw,
    res: req.context.res,
});

export const createGraphqlRouter = (authConfig: AuthConfig, mcpAdminService: McpGraphqlService) => {
    const csrfProtection = createCsrfProtection(authConfig);

    return Router()
        .use(
            '/mcp',
            createMcpAuthMiddleware(authConfig, mcpAdminService),
            createHandler({
                schema,
                context: createGraphqlContext(authConfig),
                validationRules: (_req, _args, specifiedRules) => {
                    return [...specifiedRules, createReadOnlyMcpValidationRule()];
                },
            }),
        )
        .use(
            '/',
            requireSessionForGraphql(authConfig),
            csrfProtection,
            createHandler({
                schema,
                context: createGraphqlContext(authConfig),
            }),
        );
};
