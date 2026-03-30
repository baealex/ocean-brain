import session from 'express-session';
import type { NextFunction, Request, Response, RequestHandler } from 'express';
import type { ValidationRule } from 'graphql';
import { GraphQLError } from 'graphql';

import type { AuthConfig } from './auth-mode.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const buildUnauthorizedPayload = () => ({
    code: 'UNAUTHORIZED',
    message: 'Authentication required'
});

const buildUnauthorizedGraphqlPayload = () => ({
    errors: [{
        message: 'Authentication required',
        extensions: { code: 'UNAUTHORIZED' }
    }]
});

export const isAuthenticatedRequest = (req: Request) => Boolean(req.session?.authenticated);

export const createSessionMiddleware = (authConfig: AuthConfig): RequestHandler => {
    if (authConfig.mode !== 'password' || !authConfig.sessionSecret) {
        return (_req, _res, next) => next();
    }

    return session({
        secret: authConfig.sessionSecret,
        name: 'ocean-brain.sid',
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: 'lax'
        }
    });
};

export const requireSessionForWrite = (authConfig: AuthConfig): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (authConfig.mode === 'disabled' || isAuthenticatedRequest(req)) {
            next();
            return;
        }

        res
            .status(401)
            .set(JSON_HEADERS)
            .json(buildUnauthorizedPayload())
            .end();
    };
};

export const requireSessionForGraphql = (authConfig: AuthConfig): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (authConfig.mode === 'disabled' || isAuthenticatedRequest(req)) {
            next();
            return;
        }

        res
            .status(401)
            .set(JSON_HEADERS)
            .json(buildUnauthorizedGraphqlPayload())
            .end();
    };
};

export const createMutationAuthValidationRule = (): ValidationRule => {
    return (context) => {
        return {
            OperationDefinition(node) {
                if (node.operation !== 'mutation') {
                    return;
                }

                context.reportError(new GraphQLError(
                    'Authentication required',
                    {
                        nodes: [node],
                        extensions: { code: 'UNAUTHORIZED' }
                    }
                ));
            }
        };
    };
};
