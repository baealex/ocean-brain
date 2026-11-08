import type { FastifyPluginAsync } from 'fastify';
import { createLoginHandler, createLogoutHandler, createSessionStatusHandler } from '../features/auth/http/api.js';
import { createUploadImageHandler } from '../features/image/http/upload.js';
import { createMarkdownImportService } from '../features/markdown-import/service.js';
import {
    createMcpAdminRevokeTokenHandler,
    createMcpAdminRotateTokenHandler,
    createMcpAdminSetEnabledHandler,
    createMcpAdminStatusHandler,
} from '../features/mcp-admin/http/handlers.js';
import type { McpAdminService } from '../features/mcp-admin/service.js';
import { createNavigationService } from '../features/navigation/service.js';
import {
    createSearchAdminListModelsHandler,
    createSearchAdminReindexHandler,
    createSearchAdminSaveConfigHandler,
    createSearchAdminStatusHandler,
    createSearchAdminTestConnectionHandler,
} from '../features/search/http/handlers.js';
import { createCsrfProtection, requireSessionForWrite } from '../modules/auth-guard.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import { createAuthAttemptRateLimit, createSessionAccessRateLimit } from '../modules/rate-limit.js';
import { createServerEventsHandler } from '../modules/server-events-handler.js';
import type { HttpRoute } from '../types/index.js';
import { createIntegrationRouter } from './integrations.js';
import { createMcpRouter } from './mcp.js';

type McpAdminApiService = Pick<
    McpAdminService,
    'getStatus' | 'setEnabled' | 'rotateToken' | 'revokeActiveToken' | 'validatePresentedToken'
>;

export const createApiRouter = (authConfig: AuthConfig, mcpAdminService: McpAdminApiService): FastifyPluginAsync => {
    return async (app) => {
        const csrfProtection = createCsrfProtection(authConfig);
        const requireSession = requireSessionForWrite(authConfig);
        const sessionAccessRateLimit = app.rateLimit(createSessionAccessRateLimit());

        const markdownImport = createMarkdownImportService();
        app.get<{ Querystring: { workspaceId?: string } }>(
            '/markdown-import/context',
            {
                preHandler: [sessionAccessRateLimit, requireSession],
            },
            (request) => markdownImport.context(request.query.workspaceId),
        );
        for (const action of ['start', 'create', 'save', 'trash'] as const) {
            app.post(
                `/markdown-import/${action}`,
                {
                    bodyLimit: 1024 * 1024,
                    preHandler: [sessionAccessRateLimit, requireSession, csrfProtection],
                    errorHandler(error, request, reply) {
                        if ((error as { statusCode?: number }).statusCode === 413) {
                            return reply.code(413).send({
                                code: 'IMPORT_BODY_TOO_LARGE',
                                message: 'Split this import into smaller batches.',
                            });
                        }
                        return app.errorHandler(error, request, reply);
                    },
                },
                (request) => markdownImport[action](request.body),
            );
        }

        app.register(createMcpRouter(authConfig, mcpAdminService), { prefix: '/mcp' });
        app.register(createIntegrationRouter(authConfig));

        const navigation = createNavigationService();
        app.get('/navigation-settings', { preHandler: [sessionAccessRateLimit, requireSession] }, () =>
            navigation.get(),
        );
        app.put<HttpRoute>(
            '/navigation-settings',
            { bodyLimit: 64 * 1024, preHandler: [sessionAccessRateLimit, requireSession, csrfProtection] },
            (request) => navigation.save(request.body),
        );

        app.get<HttpRoute>('/auth/session', createSessionStatusHandler(authConfig));
        app.post<HttpRoute>(
            '/auth/login',
            {
                preHandler: csrfProtection,
                config: { rateLimit: createAuthAttemptRateLimit() },
            },
            createLoginHandler(authConfig),
        );
        app.post<HttpRoute>(
            '/auth/logout',
            {
                preHandler: [sessionAccessRateLimit, requireSession, csrfProtection],
            },
            createLogoutHandler(authConfig),
        );
        app.get<HttpRoute>(
            '/mcp-admin/status',
            {
                preHandler: [sessionAccessRateLimit, requireSession],
            },
            createMcpAdminStatusHandler(mcpAdminService),
        );
        app.post<HttpRoute>(
            '/mcp-admin/enabled',
            {
                preHandler: [sessionAccessRateLimit, requireSession, csrfProtection],
            },
            createMcpAdminSetEnabledHandler(mcpAdminService),
        );
        app.post<HttpRoute>(
            '/mcp-admin/token/rotate',
            {
                preHandler: [sessionAccessRateLimit, requireSession, csrfProtection],
            },
            createMcpAdminRotateTokenHandler(mcpAdminService),
        );
        app.post<HttpRoute>(
            '/mcp-admin/token/revoke',
            {
                preHandler: [sessionAccessRateLimit, requireSession, csrfProtection],
            },
            createMcpAdminRevokeTokenHandler(mcpAdminService),
        );
        app.get<HttpRoute>(
            '/search-admin/status',
            {
                preHandler: [sessionAccessRateLimit, requireSession],
            },
            createSearchAdminStatusHandler(),
        );
        app.post<HttpRoute>(
            '/search-admin/config',
            {
                preHandler: [sessionAccessRateLimit, requireSession, csrfProtection],
            },
            createSearchAdminSaveConfigHandler(),
        );
        app.post<HttpRoute>(
            '/search-admin/models',
            {
                preHandler: [sessionAccessRateLimit, requireSession, csrfProtection],
            },
            createSearchAdminListModelsHandler(),
        );
        app.post<HttpRoute>(
            '/search-admin/test',
            {
                preHandler: [sessionAccessRateLimit, requireSession, csrfProtection],
            },
            createSearchAdminTestConnectionHandler(),
        );
        app.post<HttpRoute>(
            '/search-admin/reindex',
            {
                preHandler: [sessionAccessRateLimit, requireSession, csrfProtection],
            },
            createSearchAdminReindexHandler(),
        );
        app.post<HttpRoute>(
            '/image',
            {
                preHandler: [sessionAccessRateLimit, requireSession, csrfProtection],
            },
            createUploadImageHandler(),
        );
        app.get<HttpRoute>(
            '/events',
            {
                preHandler: [sessionAccessRateLimit, requireSession],
            },
            createServerEventsHandler(),
        );

        app.all<HttpRoute>('/*', (_request, reply) => {
            return reply.status(404).send({
                code: 'API_ROUTE_NOT_FOUND',
                message: 'The requested API route was not found.',
            });
        });
    };
};
