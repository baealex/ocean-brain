import express from 'express';
import { createSessionMiddleware } from './modules/auth-guard.js';
import type { AuthConfig } from './modules/auth-mode.js';
import { createErrorHandler } from './modules/error-handler.js';
import logger from './modules/logger.js';
import { createMcpAdminService, type McpAdminService } from './modules/mcp-admin.js';
import { purgeExpiredNoteSnapshots } from './modules/note-snapshot.js';
import { purgeExpiredTrashedNotes } from './modules/note-trash.js';
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
        .use('/auth', createAuthPagesRouter(authConfig))
        .use('/graphql', createGraphqlRouter(authConfig, mcpAdminService))
        .use(createClientRouter(authConfig))
        .use(createErrorHandler());

    return app;
};

export default createApp;
