import fastifyCookie, { Signer } from '@fastify/cookie';
import fastifyCsrfProtection from '@fastify/csrf-protection';
import fastifyFormbody from '@fastify/formbody';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySession from '@fastify/session';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { createMcpAdminService, type McpAdminService } from './features/mcp-admin/service.js';
import { purgeExpiredNoteSnapshots } from './features/note/services/snapshot.js';
import { purgeExpiredTrashedNotes } from './features/note/services/trash.js';
import type { AuthConfig } from './modules/auth-mode.js';
import { createAppError, createErrorHandler } from './modules/error-handler.js';
import { AUTH_SESSION_IDLE_TIMEOUT_MS, createSessionStore } from './modules/session-store.js';
import type { ClientContentHandler } from './routes/client.js';
import { createApiRouter, createAuthPagesRouter, createClientRouter, createGraphqlRouter } from './routes/index.js';

const MAX_REQUEST_BODY_BYTES = 50 * 1024 * 1024;

export type CreateFastifyApplicationOptions = {
    logger?: boolean;
};

export type CreateAppOptions = CreateFastifyApplicationOptions & {
    application?: FastifyInstance;
    clientContentHandler?: ClientContentHandler;
};

const isHttpLoggerEnabled = (loggerOption?: boolean) =>
    loggerOption ?? process.env.OCEAN_BRAIN_HTTP_LOG?.toLowerCase() !== 'false';

const createLoggerOptions = (): FastifyServerOptions['logger'] => ({
    level: 'info',
    serializers: {
        req(request) {
            return {
                method: request.method,
                url: request.url,
                remoteAddress: request.ip,
                userAgent: request.headers['user-agent'],
            };
        },
        res(reply) {
            return { statusCode: reply.statusCode };
        },
    },
});

export const createFastifyApplication = (options: CreateFastifyApplicationOptions = {}) =>
    Fastify({
        bodyLimit: MAX_REQUEST_BODY_BYTES,
        routerOptions: { ignoreTrailingSlash: true },
        logger: isHttpLoggerEnabled(options.logger) ? createLoggerOptions() : false,
    });

const registerRequestInfrastructure = (app: FastifyInstance, authConfig: AuthConfig) => {
    app.addHook('onRequest', (request, _reply, done) => {
        const contentEncoding = request.headers['content-encoding'];
        if (contentEncoding && contentEncoding.toLowerCase() !== 'identity') {
            done(createAppError(415, 'UNSUPPORTED_CONTENT_ENCODING', 'Compressed request bodies are not supported.'));
            return;
        }

        done();
    });

    app.register(fastifyCookie);
    app.register(fastifyFormbody);
    app.register(fastifyRateLimit, {
        global: false,
        enableDraftSpec: true,
    });

    if (authConfig.mode !== 'password') {
        return;
    }

    const sessionStore = createSessionStore();
    app.addHook('onClose', (_instance, done) => {
        if ('stopPruning' in sessionStore && typeof sessionStore.stopPruning === 'function') {
            sessionStore.stopPruning();
        }
        done();
    });
    app.register(fastifySession, {
        // Preserve the configured secret bytes and support legacy secrets shorter than 32 characters.
        secret: new Signer(authConfig.sessionSecret),
        cookieName: authConfig.cookieName,
        cookiePrefix: 's:',
        store: sessionStore,
        saveUninitialized: false,
        rolling: true,
        cookie: {
            maxAge: AUTH_SESSION_IDLE_TIMEOUT_MS,
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
        },
    });
    app.register(fastifyCsrfProtection, {
        sessionPlugin: '@fastify/session',
        logLevel: 'debug',
    });
};

export const createApp = (authConfig: AuthConfig, options: CreateAppOptions = {}) => {
    const mcpAdminService = createMcpAdminService();
    return createAppWithMcpAuth(authConfig, mcpAdminService, options);
};

export const createAppWithMcpAuth = (
    authConfig: AuthConfig,
    mcpAdminService: McpAdminService,
    options: CreateAppOptions = {},
) => {
    const app = options.application ?? createFastifyApplication(options);

    void Promise.all([purgeExpiredNoteSnapshots(), purgeExpiredTrashedNotes()]).catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown recovery cleanup error';
        process.stderr.write(`[recovery] Startup cleanup failed: ${message}\n`);
    });

    registerRequestInfrastructure(app, authConfig);
    app.setErrorHandler(createErrorHandler(authConfig));
    app.register(createApiRouter(authConfig, mcpAdminService), { prefix: '/api' });
    app.register(createAuthPagesRouter(authConfig));
    app.register(createGraphqlRouter(authConfig, mcpAdminService));
    app.register(createClientRouter(authConfig, options.clientContentHandler));

    return app;
};

export default createApp;
