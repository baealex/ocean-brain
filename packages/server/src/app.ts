import express from 'express';
import path from 'path';
import { createHandler } from 'graphql-http/lib/use/express';

import logger from './modules/logger.js';
import { paths } from './paths.js';
import schema from './schema/index.js';
import { createApiRouter } from './urls.js';
import { createMutationAuthValidationRule, createSessionMiddleware, isAuthenticatedRequest } from './modules/auth-guard.js';
import type { AuthConfig } from './modules/auth-mode.js';
import {
    createMcpAuthMiddleware,
    createReadOnlyMcpValidationRule,
    resolveMcpAuthConfig,
    type McpAuthConfig
} from './modules/mcp-auth.js';
import {
    createLoginPageHandler,
    createLoginPageSubmitHandler,
    createLogoutPageHandler
} from './views/auth.js';

const shouldBlockClientRoute = (authConfig: AuthConfig, requestPath: string, authenticated: boolean) => {
    if (authConfig.mode !== 'password' || authenticated) {
        return false;
    }

    if (requestPath.startsWith('/api') || requestPath.startsWith('/graphql') || requestPath.startsWith('/auth')) {
        return false;
    }

    return path.extname(requestPath) === '';
};

export const createApp = (authConfig: AuthConfig) => {
    const mcpAuthConfig = resolveMcpAuthConfig(process.env);
    return createAppWithMcpAuth(authConfig, mcpAuthConfig);
};

export const createAppWithMcpAuth = (authConfig: AuthConfig, mcpAuthConfig: McpAuthConfig) => {
    const app = express();
    app.locals.authConfig = authConfig;

    app.use(logger)
        .use(createSessionMiddleware(authConfig))
        .use(express.urlencoded({ extended: false }))
        .use(express.json({ limit: '50mb' }))
        .use('/assets/images/', express.static(paths.imageDir))
        .use('/api', createApiRouter(authConfig))
        .get('/auth/login', createLoginPageHandler(authConfig))
        .post('/auth/login', createLoginPageSubmitHandler(authConfig))
        .post('/auth/logout', createLogoutPageHandler(authConfig))
        .use('/graphql/mcp', createMcpAuthMiddleware(authConfig, mcpAuthConfig), createHandler({
            schema,
            context: (req) => ({
                authMode: authConfig.mode,
                isAuthenticated: isAuthenticatedRequest(req.raw),
                req: req.raw,
                res: req.context.res
            }),
            validationRules: (_req, _args, specifiedRules) => {
                return [...specifiedRules, createReadOnlyMcpValidationRule()];
            }
        }))
        .use('/graphql', createHandler({
            schema,
            context: (req) => ({
                authMode: authConfig.mode,
                isAuthenticated: isAuthenticatedRequest(req.raw),
                req: req.raw,
                res: req.context.res
            }),
            validationRules: (req, _args, specifiedRules) => {
                if (authConfig.mode === 'disabled' || isAuthenticatedRequest(req.raw)) {
                    return specifiedRules;
                }

                return [...specifiedRules, createMutationAuthValidationRule()];
            }
        }))
        .use((req, res, next) => {
            if (shouldBlockClientRoute(authConfig, req.path, isAuthenticatedRequest(req))) {
                const redirectPath = encodeURIComponent(req.originalUrl || '/');
                res.redirect(303, `/auth/login?next=${redirectPath}`);
                return;
            }

            next();
        })
        .use(express.static(paths.clientDist, { extensions: ['html'] }))
        .get(/.*/, (_req, res) => {
            res.sendFile(paths.clientIndex);
        });

    return app;
};

export default createApp;
