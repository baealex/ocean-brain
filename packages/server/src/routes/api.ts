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
import { requireSessionForWrite } from '../modules/auth-guard.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import { createServerEventsHandler } from '../modules/server-events-handler.js';
import useAsync from '../modules/use-async.js';
import { createMcpRouter } from './mcp.js';

type McpAdminApiService = Pick<
    McpAdminService,
    'getStatus' | 'setEnabled' | 'rotateToken' | 'revokeActiveToken' | 'validatePresentedToken'
>;

export const createApiRouter = (authConfig: AuthConfig, mcpAdminService: McpAdminApiService) =>
    Router()
        .use('/mcp', createMcpRouter(authConfig, mcpAdminService))
        .post('/auth/login', useAsync(createLoginHandler(authConfig)))
        .post('/auth/logout', useAsync(createLogoutHandler(authConfig)))
        .get('/auth/session', useAsync(createSessionStatusHandler(authConfig)))
        .get(
            '/mcp-admin/status',
            requireSessionForWrite(authConfig),
            useAsync(createMcpAdminStatusHandler(mcpAdminService)),
        )
        .post(
            '/mcp-admin/enabled',
            requireSessionForWrite(authConfig),
            useAsync(createMcpAdminSetEnabledHandler(mcpAdminService)),
        )
        .post(
            '/mcp-admin/token/rotate',
            requireSessionForWrite(authConfig),
            useAsync(createMcpAdminRotateTokenHandler(mcpAdminService)),
        )
        .post(
            '/mcp-admin/token/revoke',
            requireSessionForWrite(authConfig),
            useAsync(createMcpAdminRevokeTokenHandler(mcpAdminService)),
        )
        .post('/image', requireSessionForWrite(authConfig), useAsync(createUploadImageHandler()))
        .post('/image-from-src', requireSessionForWrite(authConfig), useAsync(createUploadImageFromSrcHandler()))
        .get('/events', requireSessionForWrite(authConfig), createServerEventsHandler());
