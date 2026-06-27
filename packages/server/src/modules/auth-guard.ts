import { buildUnauthorizedGraphqlPayload, buildUnauthorizedPayload } from '@baejino/auth';
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import session from 'express-session';
import type { ValidationRule } from 'graphql';
import { GraphQLError } from 'graphql';
import lusca from 'lusca';
import type { AuthConfig } from './auth-mode.js';
import { sanitizeRedirectPath } from './auth-redirect.js';
import { AUTH_SESSION_IDLE_TIMEOUT_MS, createSessionStore } from './session-store.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const isAuthenticatedRequest = (req: Request) => Boolean(req.session?.authenticated);

export const createSessionMiddleware = (authConfig: AuthConfig): RequestHandler => {
    if (authConfig.mode !== 'password') {
        return (_req, _res, next) => next();
    }

    return session({
        secret: authConfig.sessionSecret,
        name: authConfig.cookieName,
        store: createSessionStore(),
        resave: false,
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
};

export const createCsrfProtection = (authConfig: AuthConfig): RequestHandler => {
    if (authConfig.mode !== 'password') {
        return (_req, _res, next) => next();
    }

    return lusca.csrf({
        angular: true,
        cookie: {
            options: {
                path: '/',
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
            },
        },
    });
};

const isCsrfTokenError = (error: unknown) => error instanceof Error && error.message.startsWith('CSRF token ');

const buildLoginRedirectPath = (req: Request) => {
    const nextPath = sanitizeRedirectPath(req.body?.next);
    return `/login?next=${encodeURIComponent(nextPath)}`;
};

export const createLoginCsrfFailureHandler = (authConfig: AuthConfig): ErrorRequestHandler => {
    return (error, req, res, next) => {
        if (
            authConfig.mode !== 'password' ||
            !isCsrfTokenError(error) ||
            req.method !== 'POST' ||
            req.path !== '/login' ||
            isAuthenticatedRequest(req)
        ) {
            next(error);
            return;
        }

        res.redirect(303, buildLoginRedirectPath(req));
    };
};

export const requireSessionForWrite = (authConfig: AuthConfig): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (authConfig.mode === 'open' || isAuthenticatedRequest(req)) {
            next();
            return;
        }

        res.status(401).set(JSON_HEADERS).json(buildUnauthorizedPayload()).end();
    };
};

export const requireSessionForGraphql = (authConfig: AuthConfig): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (authConfig.mode === 'open' || isAuthenticatedRequest(req)) {
            next();
            return;
        }

        res.status(401).set(JSON_HEADERS).json(buildUnauthorizedGraphqlPayload()).end();
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
