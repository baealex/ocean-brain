import { buildUnauthorizedGraphqlPayload, buildUnauthorizedPayload } from '@baejino/auth';
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { ValidationRule } from 'graphql';
import { GraphQLError } from 'graphql';
import type { AuthConfig } from './auth-mode.js';
import { sanitizeRedirectPath } from './auth-redirect.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const CSRF_COOKIE_NAME = 'XSRF-TOKEN';

export const isAuthenticatedRequest = (request: FastifyRequest) => Boolean(request.session?.authenticated);

export const issueCsrfToken = (authConfig: AuthConfig, reply: FastifyReply) => {
    if (authConfig.mode !== 'password') {
        return undefined;
    }

    const token = reply.generateCsrf();
    reply.setCookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false,
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });
    return token;
};

export const createCsrfProtection = (authConfig: AuthConfig): preHandlerHookHandler => {
    if (authConfig.mode !== 'password') {
        return (request, reply, done) => {
            if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
                done();
                return;
            }
            // Embedded integration pages have an opaque Origin. Even an explicitly open
            // local server must not let them bypass integration grants through owner APIs.
            const origin = request.headers.origin;
            if (origin) {
                let sameHost = false;
                try {
                    const url = new URL(origin);
                    sameHost = ['http:', 'https:'].includes(url.protocol) && url.host === request.headers.host;
                } catch {
                    sameHost = false;
                }
                if (!sameHost) {
                    void reply.status(403).send({
                        code: 'FORBIDDEN_ORIGIN',
                        message: 'Owner writes require the Ocean Brain page origin.',
                    });
                    return;
                }
            }
            done();
        };
    }

    return (request, reply, done) => {
        if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
            done();
            return;
        }

        request.server.csrfProtection(request, reply, done);
    };
};

export const isCsrfTokenError = (error: unknown) =>
    error instanceof Error &&
    ('code' in error
        ? error.code === 'FST_CSRF_INVALID_TOKEN' || error.code === 'FST_CSRF_MISSING_SECRET'
        : error.message.toLowerCase().includes('csrf'));

export const buildLoginCsrfRedirectPath = (request: FastifyRequest) => {
    const body = request.body as Record<string, unknown> | undefined;
    const nextPath = sanitizeRedirectPath(body?.next);
    return `/login?next=${encodeURIComponent(nextPath)}`;
};

export const shouldRedirectLoginCsrfFailure = (error: unknown, request: FastifyRequest, authConfig: AuthConfig) =>
    authConfig.mode === 'password' &&
    isCsrfTokenError(error) &&
    request.method === 'POST' &&
    request.url.split('?')[0] === '/login' &&
    !isAuthenticatedRequest(request);

export const requireSessionForWrite = (authConfig: AuthConfig): preHandlerHookHandler => {
    return (request, reply, done) => {
        if (authConfig.mode === 'open' || isAuthenticatedRequest(request)) {
            done();
            return;
        }

        void reply.code(401).headers(JSON_HEADERS).send(buildUnauthorizedPayload());
    };
};

export const requireSessionForGraphql = (authConfig: AuthConfig): preHandlerHookHandler => {
    return (request, reply, done) => {
        if (authConfig.mode === 'open' || isAuthenticatedRequest(request)) {
            done();
            return;
        }

        void reply.code(401).headers(JSON_HEADERS).send(buildUnauthorizedGraphqlPayload());
    };
};

export const createMutationAuthValidationRule = (): ValidationRule => {
    return (context) => {
        return {
            OperationDefinition(node) {
                if (node.operation !== 'mutation') {
                    return;
                }

                const unauthorizedError = buildUnauthorizedGraphqlPayload().errors[0];

                context.reportError(
                    new GraphQLError(unauthorizedError.message, {
                        nodes: [node],
                        extensions: {
                            code: unauthorizedError.extensions.code,
                        },
                    }),
                );
            },
        };
    };
};
