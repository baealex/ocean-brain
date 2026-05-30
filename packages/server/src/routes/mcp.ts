import { Router } from 'express';
import type { McpAdminService } from '../features/mcp-admin/service.js';
import {
    createMcpAppendNoteMarkdownHandler,
    createMcpCreateNoteHandler,
    createMcpDeleteNoteHandler,
    createMcpPatchNoteMarkdownHandler,
    createMcpReplaceNoteMarkdownHandler,
    createMcpUpdateNoteHandler,
    createMcpUpdateNoteMetadataHandler,
} from '../features/note/http/mcp.js';
import { createMcpCreateTagHandler } from '../features/tag/http/mcp.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import { createMcpAuthMiddleware } from '../modules/mcp-auth.js';
import useAsync from '../modules/use-async.js';

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
            '/notes/patch-markdown',
            createMcpAuthMiddleware(authConfig, mcpAdminService),
            useAsync(createMcpPatchNoteMarkdownHandler()),
        )
        .post(
            '/notes/append-markdown',
            createMcpAuthMiddleware(authConfig, mcpAdminService),
            useAsync(createMcpAppendNoteMarkdownHandler()),
        )
        .post(
            '/notes/metadata',
            createMcpAuthMiddleware(authConfig, mcpAdminService),
            useAsync(createMcpUpdateNoteMetadataHandler()),
        )
        .post(
            '/notes/replace-markdown',
            createMcpAuthMiddleware(authConfig, mcpAdminService),
            useAsync(createMcpReplaceNoteMarkdownHandler()),
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
