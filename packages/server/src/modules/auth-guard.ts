import { buildUnauthorizedGraphqlPayload, buildUnauthorizedPayload } from '@baejino/auth';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import session from 'express-session';
import type { ValidationRule } from 'graphql';
import { GraphQLError } from 'graphql';

import type { AuthConfig } from './auth-mode.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const isAuthenticatedRequest = (req: Request) => Boolean(req.session?.authenticated);

export const createSessionMiddleware = (authConfig: AuthConfig): RequestHandler => {
    if (authConfig.mode !== 'password') {
        return (_req, _res, next) => next();
    }

    return session({
        secret: authConfig.sessionSecret,
        name: authConfig.cookieName,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
        },
    });
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
