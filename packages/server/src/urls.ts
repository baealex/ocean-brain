import { Router } from 'express';
import { requireSessionForWrite } from './modules/auth-guard.js';
import type { AuthConfig } from './modules/auth-mode.js';
import type { McpAdminService } from './modules/mcp-admin.js';
import useAsync from './modules/use-async.js';
import * as views from './views/index.js';

type McpAdminApiService = Pick<McpAdminService, 'getStatus' | 'setEnabled' | 'rotateToken' | 'revokeActiveToken'>;

export const createApiRouter = (authConfig: AuthConfig, mcpAdminService: McpAdminApiService) =>
    Router()
        .post('/auth/login', useAsync(views.createLoginHandler(authConfig)))
        .post('/auth/logout', useAsync(views.createLogoutHandler(authConfig)))
        .get('/auth/session', useAsync(views.createSessionStatusHandler(authConfig)))
        .get(
            '/mcp-admin/status',
            requireSessionForWrite(authConfig),
            useAsync(views.createMcpAdminStatusHandler(mcpAdminService)),
        )
        .post(
            '/mcp-admin/enabled',
            requireSessionForWrite(authConfig),
            useAsync(views.createMcpAdminSetEnabledHandler(mcpAdminService)),
        )
        .post(
            '/mcp-admin/token/rotate',
            requireSessionForWrite(authConfig),
            useAsync(views.createMcpAdminRotateTokenHandler(mcpAdminService)),
        )
        .post(
            '/mcp-admin/token/revoke',
            requireSessionForWrite(authConfig),
            useAsync(views.createMcpAdminRevokeTokenHandler(mcpAdminService)),
        )
        .post('/image', requireSessionForWrite(authConfig), useAsync(views.uploadImage))
        .post('/image-from-src', requireSessionForWrite(authConfig), useAsync(views.uploadImageFromSrc));
