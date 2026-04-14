import { Router } from 'express';
import {
    createMcpCreateNoteHandler,
    createMcpDeleteNoteHandler,
    createMcpUpdateNoteHandler,
} from '../features/note/http/mcp.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import type { McpAdminService } from '../modules/mcp-admin.js';
import { createMcpAuthMiddleware } from '../modules/mcp-auth.js';
import useAsync from '../modules/use-async.js';
import { createMcpCreateTagHandler } from '../views/tag.js';

type McpRouteService = Pick<McpAdminService, 'getStatus' | 'validatePresentedToken'>;

export const createMcpRouter = (authConfig: AuthConfig, mcpAdminService: McpRouteService) =>
    Router()
        .post(
            '/notes/create',
            createMcpAuthMiddleware(authConfig, mcpAdminService),
            useAsync(createMcpCreateNoteHandler()),
        )
        .post(
            '/notes/update',
            createMcpAuthMiddleware(authConfig, mcpAdminService),
            useAsync(createMcpUpdateNoteHandler()),
        )
        .post(
            '/notes/delete',
            createMcpAuthMiddleware(authConfig, mcpAdminService),
            useAsync(createMcpDeleteNoteHandler()),
        )
        .post(
            '/tags/create',
            createMcpAuthMiddleware(authConfig, mcpAdminService),
            useAsync(createMcpCreateTagHandler()),
        );
