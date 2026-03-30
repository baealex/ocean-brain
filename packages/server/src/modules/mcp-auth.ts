import type { NextFunction, Request, Response, RequestHandler } from 'express';
import type { ValidationRule } from 'graphql';
import { GraphQLError } from 'graphql';

import { compareSharedSecret } from './auth.js';
import type { AuthConfig } from './auth-mode.js';

export interface McpAuthConfig {
    tokens: string[];
}

export interface McpAuthEnvironment {
    [key: string]: string | undefined;
    OCEAN_BRAIN_MCP_TOKEN?: string;
    OCEAN_BRAIN_MCP_TOKENS?: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const splitTokens = (value?: string) => {
    if (!value) {
        return [];
    }

    return value
        .split(/[,\r\n]+/)
        .map((token) => token.trim())
        .filter(Boolean);
};

const readBearerToken = (authorizationHeader?: string) => {
    if (!authorizationHeader?.startsWith('Bearer ')) {
        return undefined;
    }

    return authorizationHeader.slice('Bearer '.length).trim() || undefined;
};

export const resolveMcpAuthConfig = (env: McpAuthEnvironment): McpAuthConfig => {
    return {
        tokens: Array.from(new Set([
            ...splitTokens(env.OCEAN_BRAIN_MCP_TOKEN),
            ...splitTokens(env.OCEAN_BRAIN_MCP_TOKENS)
        ]))
    };
};

export const createMcpAuthMiddleware = (
    authConfig: AuthConfig,
    mcpAuthConfig: McpAuthConfig
): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (authConfig.mode === 'disabled') {
            next();
            return;
        }

        if (mcpAuthConfig.tokens.length === 0) {
            res
                .status(503)
                .set(JSON_HEADERS)
                .json({
                    code: 'MCP_AUTH_NOT_CONFIGURED',
                    message: 'MCP bearer auth is not configured for password mode.'
                })
                .end();
            return;
        }

        const bearerToken = readBearerToken(req.headers.authorization);

        if (!bearerToken) {
            res
                .status(401)
                .set(JSON_HEADERS)
                .json({
                    code: 'UNAUTHORIZED',
                    message: 'A valid MCP bearer token is required.'
                })
                .end();
            return;
        }

        const isValidToken = mcpAuthConfig.tokens.some((token) => compareSharedSecret(token, bearerToken));

        if (!isValidToken) {
            res
                .status(403)
                .set(JSON_HEADERS)
                .json({
                    code: 'FORBIDDEN',
                    message: 'Invalid MCP bearer token.'
                })
                .end();
            return;
        }

        next();
    };
};

export const createReadOnlyMcpValidationRule = (): ValidationRule => {
    return (context) => {
        return {
            OperationDefinition(node) {
                if (node.operation === 'query') {
                    return;
                }

                context.reportError(new GraphQLError(
                    'MCP endpoint is read-only',
                    {
                        nodes: [node],
                        extensions: { code: 'FORBIDDEN' }
                    }
                ));
            }
        };
    };
};
