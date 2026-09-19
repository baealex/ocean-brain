import type { FastifyPluginAsync } from 'fastify';
import mercurius from 'mercurius';
import { requireIntegrationPermission } from '../features/integration/auth.js';
import {
    createIntegrationNoteCatalogHandler,
    createIntegrationNoteEventsHandler,
} from '../features/integration/note-sync.js';
import { integrationReadSchema } from '../features/integration/schema.js';
import { createIntegrationService } from '../features/integration/service.js';
import {
    createAppendNoteMarkdownHandler,
    createCreateNoteHandler,
    createDeleteNoteHandler,
    createNoteWriteBaselineHandler,
    createPatchNoteMarkdownHandler,
    createReplaceNoteMarkdownHandler,
    createUpdateNoteMetadataHandler,
} from '../features/note/http/authoring.js';
import { createCsrfProtection, requireSessionForWrite } from '../modules/auth-guard.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import { createAppError } from '../modules/error-handler.js';
import { createReadOnlyMcpValidationRule } from '../modules/mcp-auth.js';
import { createSessionAccessRateLimit } from '../modules/rate-limit.js';
import type { HttpRoute } from '../types/index.js';

export const createIntegrationRouter =
    (authConfig: AuthConfig): FastifyPluginAsync =>
    async (app) => {
        const service = createIntegrationService();
        app.register(
            async (api) => {
                api.register(async (read) => {
                    read.addHook('preHandler', requireIntegrationPermission('notes:read', service));
                    read.register(mercurius, {
                        schema: integrationReadSchema,
                        path: '/graphql',
                        graphiql: false,
                        queryDepth: 16,
                        validationRules: [createReadOnlyMcpValidationRule('Integration GraphQL endpoint is read-only')],
                        context: (req) => ({ integration: req.integration }),
                    });
                });
                api.get(
                    '/me',
                    { preHandler: requireIntegrationPermission('notes:read', service) },
                    async (request) => ({
                        apiVersion: 1,
                        ...request.integration,
                    }),
                );
                api.get<HttpRoute>(
                    '/events',
                    { preHandler: requireIntegrationPermission('notes:read', service) },
                    createIntegrationNoteEventsHandler(),
                );
                api.post<HttpRoute>(
                    '/notes/catalog',
                    { preHandler: requireIntegrationPermission('notes:read', service) },
                    createIntegrationNoteCatalogHandler(),
                );
                api.post<HttpRoute>(
                    '/notes/create',
                    { preHandler: requireIntegrationPermission('notes:create', service) },
                    createCreateNoteHandler(),
                );
                api.post<HttpRoute>(
                    '/notes/baseline',
                    { preHandler: requireIntegrationPermission('notes:read', service) },
                    createNoteWriteBaselineHandler(),
                );
                api.post<HttpRoute>(
                    '/notes/patch-markdown',
                    { preHandler: requireIntegrationPermission('notes:update', service) },
                    createPatchNoteMarkdownHandler(),
                );
                api.post<HttpRoute>(
                    '/notes/append-markdown',
                    { preHandler: requireIntegrationPermission('notes:update', service) },
                    createAppendNoteMarkdownHandler(),
                );
                api.post<HttpRoute>(
                    '/notes/replace-markdown',
                    { preHandler: requireIntegrationPermission('notes:update', service) },
                    createReplaceNoteMarkdownHandler(),
                );
                api.post<HttpRoute>(
                    '/notes/metadata',
                    { preHandler: requireIntegrationPermission('notes:update', service) },
                    createUpdateNoteMetadataHandler(),
                );
                api.post<HttpRoute>(
                    '/notes/delete',
                    { preHandler: requireIntegrationPermission('notes:delete', service) },
                    createDeleteNoteHandler(),
                );
            },
            { prefix: '/integrations/v1' },
        );

        app.register(
            async (admin) => {
                admin.addHook('preHandler', app.rateLimit(createSessionAccessRateLimit()));
                admin.addHook('preHandler', requireSessionForWrite(authConfig));
                admin.addHook('preHandler', createCsrfProtection(authConfig));
                admin.get('/connections', async () => ({ connections: await service.list() }));
                admin.post<HttpRoute>('/connections', { bodyLimit: 64 * 1024 }, async (request, reply) => {
                    if (!request.body)
                        throw createAppError(400, 'INVALID_INTEGRATION_MANIFEST', 'A manifest is required.');
                    const connection = await service.connect({
                        manifest: request.body.manifest,
                        grantedPermissions: request.body.grantedPermissions,
                        proxyUrl: request.body.proxyUrl,
                    });
                    return reply.status(201).send(connection);
                });
                admin.patch<HttpRoute>('/connections/:id', { bodyLimit: 64 * 1024 }, async (request) =>
                    service.update(request.params.id, request.body ?? {}),
                );
                admin.delete<HttpRoute>('/connections/:id', async (request) => {
                    await service.disconnect(request.params.id);
                    return { disconnected: true };
                });
                admin.post<HttpRoute>('/connections/:id/token/rotate', async (request) =>
                    service.rotateToken(request.params.id),
                );
                admin.post<HttpRoute>('/connections/:id/token/revoke', async (request) => {
                    await service.revokeToken(request.params.id);
                    return { revoked: true };
                });
            },
            { prefix: '/integration-admin' },
        );
    };
