import type { FastifyPluginAsync } from 'fastify';
import type { IntegrationPermission } from '../features/integration/manifest.js';
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
        const requireMcpAuth = (permission: IntegrationPermission) =>
            createMcpAuthMiddleware(authConfig, mcpAdminService, permission);

        app.post<HttpRoute>(
            '/notes/create',
            { preHandler: requireMcpAuth('notes:create') },
            createMcpCreateNoteHandler(),
        );
        app.post<HttpRoute>(
            '/notes/baseline',
            { preHandler: requireMcpAuth('notes:read') },
            createMcpNoteWriteBaselineHandler(),
        );
        app.post<HttpRoute>(
            '/notes/patch-markdown',
            { preHandler: requireMcpAuth('notes:update') },
            createMcpPatchNoteMarkdownHandler(),
        );
        app.post<HttpRoute>(
            '/notes/append-markdown',
            { preHandler: requireMcpAuth('notes:update') },
            createMcpAppendNoteMarkdownHandler(),
        );
        app.post<HttpRoute>(
            '/notes/metadata',
            { preHandler: requireMcpAuth('notes:update') },
            createMcpUpdateNoteMetadataHandler(),
        );
        app.post<HttpRoute>(
            '/notes/replace-markdown',
            { preHandler: requireMcpAuth('notes:update') },
            createMcpReplaceNoteMarkdownHandler(),
        );
        app.post<HttpRoute>(
            '/notes/delete',
            { preHandler: requireMcpAuth('notes:delete') },
            createMcpDeleteNoteHandler(),
        );
        app.post<HttpRoute>(
            '/tags/create',
            { preHandler: requireMcpAuth('notes:update') },
            createMcpCreateTagHandler(),
        );
    };
};
