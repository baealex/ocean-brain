import path from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { isAuthenticatedRequest, issueCsrfToken } from '../modules/auth-guard.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import { createImageAssetRateLimit } from '../modules/rate-limit.js';
import { paths } from '../paths.js';

export type ClientContentHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown> | unknown;

const getRequestPath = (request: FastifyRequest) => request.url.split('?')[0] || '/';

const isClientDocumentRequest = (request: FastifyRequest) => {
    const accept = request.headers.accept;
    return (
        request.method === 'GET' &&
        Boolean(accept?.includes('text/html')) &&
        path.extname(getRequestPath(request)) === ''
    );
};

const shouldBlockClientRoute = (authConfig: AuthConfig, requestPath: string, authenticated: boolean) => {
    if (authConfig.mode !== 'password' || authenticated) {
        return false;
    }

    if (
        requestPath.startsWith('/api') ||
        requestPath.startsWith('/graphql') ||
        requestPath === '/login' ||
        requestPath === '/logout'
    ) {
        return false;
    }

    return path.extname(requestPath) === '';
};

const createProtectedImageAssetsMiddleware = (authConfig: AuthConfig): preHandlerHookHandler => {
    return (request, reply, done) => {
        if (authConfig.mode !== 'password' || isAuthenticatedRequest(request)) {
            done();
            return;
        }

        if (request.headers.accept?.includes('text/html')) {
            const redirectPath = encodeURIComponent(request.url || '/');
            void reply.redirect(`/login?next=${redirectPath}`, 303);
            return;
        }

        void reply.status(401).send();
    };
};

const setImageHeaders = (authConfig: AuthConfig, reply: FastifyReply) => {
    reply.header('X-Content-Type-Options', 'nosniff');

    if (authConfig.mode === 'password') {
        reply.header('Cache-Control', 'no-store');
    }
};

const createProductionClientContentHandler = (): ClientContentHandler => {
    return (request, reply) => {
        if (isClientDocumentRequest(request)) {
            return reply.sendFile('index.html', paths.clientDist);
        }

        const filePath = getRequestPath(request).replace(/^\/+/, '');
        return reply.sendFile(filePath, paths.clientDist, { extensions: ['html'] });
    };
};

export const createClientRouter = (
    authConfig: AuthConfig,
    clientContentHandler: ClientContentHandler = createProductionClientContentHandler(),
): FastifyPluginAsync => {
    return async (app) => {
        app.register(fastifyStatic, { serve: false });

        app.get<{ Params: { '*': string } }>(
            '/assets/images/*',
            {
                onRequest: (_request, reply, done) => {
                    setImageHeaders(authConfig, reply);
                    done();
                },
                preHandler: createProtectedImageAssetsMiddleware(authConfig),
                config: { rateLimit: createImageAssetRateLimit(authConfig) },
            },
            (request, reply) => {
                return reply.sendFile(request.params['*'], paths.imageDir, { cacheControl: false });
            },
        );

        const handleClientRequest = async (request: FastifyRequest, reply: FastifyReply) => {
            const requestPath = getRequestPath(request);
            if (shouldBlockClientRoute(authConfig, requestPath, isAuthenticatedRequest(request))) {
                return reply.redirect(`/login?next=${encodeURIComponent(request.url || '/')}`, 303);
            }

            if (path.extname(requestPath) === '') {
                issueCsrfToken(authConfig, reply);
            }

            return clientContentHandler(request, reply);
        };

        app.get('/', handleClientRequest);
        app.get('/*', handleClientRequest);

        app.setNotFoundHandler((_request, reply) => {
            return reply.header('X-Content-Type-Options', 'nosniff').status(404).send();
        });
    };
};
