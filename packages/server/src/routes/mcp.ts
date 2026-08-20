import type { FastifyPluginAsync } from 'fastify';
import type { McpAdminService } from '../features/mcp-admin/service.js';
import {
    createMcpAppendNoteMarkdownHandler,
    createMcpCreateNoteHandler,
    createMcpDeleteNoteHandler,
    createMcpNoteWriteBaselineHandler,
    createMcpPatchNoteMarkdownHandler,
    createMcpReplaceNoteMarkdownHandler,
    createMcpUpdateNoteMetadataHandler,
} from '../features/note/http/mcp.js';
import { createMcpCreateTagHandler } from '../features/tag/http/mcp.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import { createMcpAuthMiddleware } from '../modules/mcp-auth.js';
import type { HttpRoute } from '../types/index.js';

type McpRouteService = Pick<McpAdminService, 'getStatus' | 'validatePresentedToken'>;

export const createMcpRouter = (authConfig: AuthConfig, mcpAdminService: McpRouteService): FastifyPluginAsync => {
    return async (app) => {
        const requireMcpAuth = createMcpAuthMiddleware(authConfig, mcpAdminService);

        app.post<HttpRoute>('/notes/create', { preHandler: requireMcpAuth }, createMcpCreateNoteHandler());
        app.post<HttpRoute>('/notes/baseline', { preHandler: requireMcpAuth }, createMcpNoteWriteBaselineHandler());
        app.post<HttpRoute>(
            '/notes/patch-markdown',
            { preHandler: requireMcpAuth },
            createMcpPatchNoteMarkdownHandler(),
        );
        app.post<HttpRoute>(
            '/notes/append-markdown',
            { preHandler: requireMcpAuth },
            createMcpAppendNoteMarkdownHandler(),
        );
        app.post<HttpRoute>('/notes/metadata', { preHandler: requireMcpAuth }, createMcpUpdateNoteMetadataHandler());
        app.post<HttpRoute>(
            '/notes/replace-markdown',
            { preHandler: requireMcpAuth },
            createMcpReplaceNoteMarkdownHandler(),
        );
        app.post<HttpRoute>('/notes/delete', { preHandler: requireMcpAuth }, createMcpDeleteNoteHandler());
        app.post<HttpRoute>('/tags/create', { preHandler: requireMcpAuth }, createMcpCreateTagHandler());
    };
};
