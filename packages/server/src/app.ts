import express from 'express';
import { createMcpAdminService, type McpAdminService } from './features/mcp-admin/service.js';
import { purgeExpiredNoteSnapshots } from './features/note/services/snapshot.js';
import { purgeExpiredTrashedNotes } from './features/note/services/trash.js';
import { createSessionMiddleware } from './modules/auth-guard.js';
import type { AuthConfig } from './modules/auth-mode.js';
import { createErrorHandler } from './modules/error-handler.js';
import logger from './modules/logger.js';
import { createApiRouter, createAuthPagesRouter, createClientRouter, createGraphqlRouter } from './routes/index.js';

export const createApp = (authConfig: AuthConfig) => {
    const mcpAdminService = createMcpAdminService();
    return createAppWithMcpAuth(authConfig, mcpAdminService);
};

export const createAppWithMcpAuth = (authConfig: AuthConfig, mcpAdminService: McpAdminService) => {
    const app = express();
    app.locals.authConfig = authConfig;

    void Promise.all([purgeExpiredNoteSnapshots(), purgeExpiredTrashedNotes()]).catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown recovery cleanup error';
        process.stderr.write(`[recovery] Startup cleanup failed: ${message}\n`);
    });

    app.use(logger)
        .use(createSessionMiddleware(authConfig))
        .use(express.urlencoded({ extended: false }))
        .use(express.json({ limit: '50mb' }))
        .use('/api', createApiRouter(authConfig, mcpAdminService))
        .use(createAuthPagesRouter(authConfig))
        .use('/graphql', createGraphqlRouter(authConfig, mcpAdminService))
        .use(createClientRouter(authConfig))
        .use(createErrorHandler());

    return app;
};

export default createApp;
