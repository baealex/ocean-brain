import { Router } from 'express';
import { createLoginHandler, createLogoutHandler, createSessionStatusHandler } from '../features/auth/http/api.js';
import { createUploadImageFromSrcHandler, createUploadImageHandler } from '../features/image/http/upload.js';
import {
    createMcpAdminRevokeTokenHandler,
    createMcpAdminRotateTokenHandler,
    createMcpAdminSetEnabledHandler,
    createMcpAdminStatusHandler,
} from '../features/mcp-admin/http/handlers.js';
import type { McpAdminService } from '../features/mcp-admin/service.js';
import { createCsrfProtection, requireSessionForWrite } from '../modules/auth-guard.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import { createAuthAttemptRateLimit } from '../modules/rate-limit.js';
import { createServerEventsHandler } from '../modules/server-events-handler.js';
import useAsync from '../modules/use-async.js';
import { createMcpRouter } from './mcp.js';

type McpAdminApiService = Pick<
    McpAdminService,
    'getStatus' | 'setEnabled' | 'rotateToken' | 'revokeActiveToken' | 'validatePresentedToken'
>;

export const createApiRouter = (authConfig: AuthConfig, mcpAdminService: McpAdminApiService) => {
    const csrfProtection = createCsrfProtection(authConfig);
    const requireSession = requireSessionForWrite(authConfig);

    return Router()
        .use('/mcp', createMcpRouter(authConfig, mcpAdminService))
        .get('/auth/session', csrfProtection, useAsync(createSessionStatusHandler(authConfig)))
        .post('/auth/login', csrfProtection, createAuthAttemptRateLimit(), useAsync(createLoginHandler(authConfig)))
        .post('/auth/logout', requireSession, csrfProtection, useAsync(createLogoutHandler(authConfig)))
        .get(
            '/mcp-admin/status',
            requireSession,
            csrfProtection,
            useAsync(createMcpAdminStatusHandler(mcpAdminService)),
        )
        .post(
            '/mcp-admin/enabled',
            requireSession,
            csrfProtection,
            useAsync(createMcpAdminSetEnabledHandler(mcpAdminService)),
        )
        .post(
            '/mcp-admin/token/rotate',
            requireSession,
            csrfProtection,
            useAsync(createMcpAdminRotateTokenHandler(mcpAdminService)),
        )
        .post(
            '/mcp-admin/token/revoke',
            requireSession,
            csrfProtection,
            useAsync(createMcpAdminRevokeTokenHandler(mcpAdminService)),
        )
        .post('/image', requireSession, csrfProtection, useAsync(createUploadImageHandler()))
        .post('/image-from-src', requireSession, csrfProtection, useAsync(createUploadImageFromSrcHandler()))
        .get('/events', requireSession, csrfProtection, createServerEventsHandler());
};
