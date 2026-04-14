import { type Request, type Response, Router } from 'express';
import { createHandler } from 'graphql-http/lib/use/express';
import { isAuthenticatedRequest, requireSessionForGraphql } from '../modules/auth-guard.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import type { McpAdminService } from '../modules/mcp-admin.js';
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

export const createGraphqlRouter = (authConfig: AuthConfig, mcpAdminService: McpGraphqlService) =>
    Router()
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
            createHandler({
                schema,
                context: createGraphqlContext(authConfig),
            }),
        );
