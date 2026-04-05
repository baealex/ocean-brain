import express from 'express';
import path from 'path';
import { createHandler } from 'graphql-http/lib/use/express';

import logger from './modules/logger.js';
import { paths } from './paths.js';
import schema from './schema/index.js';
import { createApiRouter } from './urls.js';
import { createSessionMiddleware, isAuthenticatedRequest, requireSessionForGraphql } from './modules/auth-guard.js';
import type { AuthConfig } from './modules/auth-mode.js';
import {
    createMcpAuthMiddleware,
    createReadOnlyMcpValidationRule
} from './modules/mcp-auth.js';
import { createMcpAdminService, type McpAdminService } from './modules/mcp-admin.js';
import {
    createLoginPageHandler,
    createLoginPageSubmitHandler,
    createLogoutPageHandler
} from './views/auth.js';
import useAsync from './modules/use-async.js';
import { createErrorHandler } from './modules/error-handler.js';
import {
    createMcpCreateNoteHandler,
    createMcpDeleteNoteHandler,
    createMcpUpdateNoteHandler
} from './views/note.js';
import { createMcpCreateTagHandler } from './views/tag.js';
import { purgeExpiredNoteSnapshots } from './modules/note-snapshot.js';
import { purgeExpiredTrashedNotes } from './modules/note-trash.js';

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
    const mcpAdminService = createMcpAdminService();
    return createAppWithMcpAuth(authConfig, mcpAdminService);
};

export const createAppWithMcpAuth = (authConfig: AuthConfig, mcpAdminService: McpAdminService) => {
    const app = express();
    app.locals.authConfig = authConfig;

    void Promise.all([
        purgeExpiredNoteSnapshots(),
        purgeExpiredTrashedNotes()
    ]).catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown recovery cleanup error';
        process.stderr.write(`[recovery] Startup cleanup failed: ${message}\n`);
    });

    app.use(logger)
        .use(createSessionMiddleware(authConfig))
        .use(express.urlencoded({ extended: false }))
        .use(express.json({ limit: '50mb' }))
        .use('/assets/images/', express.static(paths.imageDir))
        .post(
            '/api/mcp/notes/create',
            createMcpAuthMiddleware(authConfig, mcpAdminService),
            useAsync(createMcpCreateNoteHandler())
        )
        .post(
            '/api/mcp/notes/update',
            createMcpAuthMiddleware(authConfig, mcpAdminService),
            useAsync(createMcpUpdateNoteHandler())
        )
        .post(
            '/api/mcp/tags/create',
            createMcpAuthMiddleware(authConfig, mcpAdminService),
            useAsync(createMcpCreateTagHandler())
        )
        .post(
            '/api/mcp/notes/delete',
            createMcpAuthMiddleware(authConfig, mcpAdminService),
            useAsync(createMcpDeleteNoteHandler())
        )
        .use('/api', createApiRouter(authConfig, mcpAdminService))
        .get('/auth/login', createLoginPageHandler(authConfig))
        .post('/auth/login', createLoginPageSubmitHandler(authConfig))
        .post('/auth/logout', createLogoutPageHandler(authConfig))
        .use('/graphql/mcp', createMcpAuthMiddleware(authConfig, mcpAdminService), createHandler({
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
        .use('/graphql', requireSessionForGraphql(authConfig), createHandler({
            schema,
            context: (req) => ({
                authMode: authConfig.mode,
                isAuthenticated: isAuthenticatedRequest(req.raw),
                req: req.raw,
                res: req.context.res
            })
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
        })
        .use(createErrorHandler());

    return app;
};

export default createApp;
