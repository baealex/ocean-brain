import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ValidationRule } from 'graphql';
import { GraphQLError } from 'graphql';

import type { AuthConfig } from './auth-mode.js';

export interface McpTokenValidationResult {
    ok: boolean;
    reason?: 'not_configured' | 'forbidden';
}

export interface McpAdminAuthPort {
    getStatus: () => Promise<{ enabled: boolean }>;
    validatePresentedToken: (token: string) => Promise<McpTokenValidationResult>;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const readBearerToken = (authorizationHeader?: string) => {
    if (!authorizationHeader?.startsWith('Bearer ')) {
        return undefined;
    }

    return authorizationHeader.slice('Bearer '.length).trim() || undefined;
};

export const createMcpAuthMiddleware = (_authConfig: AuthConfig, mcpAdminAuth: McpAdminAuthPort): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const status = await mcpAdminAuth.getStatus();
            if (!status.enabled) {
                res.status(403)
                    .set(JSON_HEADERS)
                    .json({
                        code: 'MCP_DISABLED',
                        message: 'MCP access is disabled by admin.',
                    })
                    .end();
                return;
            }

            const bearerToken = readBearerToken(req.headers.authorization);

            if (!bearerToken) {
                res.status(401)
                    .set(JSON_HEADERS)
                    .json({
                        code: 'UNAUTHORIZED',
                        message: 'A valid MCP bearer token is required.',
                    })
                    .end();
                return;
            }

            const validation = await mcpAdminAuth.validatePresentedToken(bearerToken);

            if (!validation.ok && validation.reason === 'not_configured') {
                res.status(503)
                    .set(JSON_HEADERS)
                    .json({
                        code: 'MCP_AUTH_NOT_CONFIGURED',
                        message: 'MCP bearer auth is not configured.',
                    })
                    .end();
                return;
            }

            if (!validation.ok) {
                res.status(403)
                    .set(JSON_HEADERS)
                    .json({
                        code: 'FORBIDDEN',
                        message: 'Invalid MCP bearer token.',
                    })
                    .end();
                return;
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

export const createReadOnlyMcpValidationRule = (): ValidationRule => {
    return (context) => {
        return {
            OperationDefinition(node) {
                if (node.operation === 'query') {
                    return;
                }

                context.reportError(
                    new GraphQLError('MCP endpoint is read-only', {
                        nodes: [node],
                        extensions: { code: 'FORBIDDEN' },
                    }),
                );
            },
        };
    };
};
