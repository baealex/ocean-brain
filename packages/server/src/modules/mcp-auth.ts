import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ValidationRule } from 'graphql';
import { GraphQLError } from 'graphql';

import { getOceanBrainVersionInfo, parseMajorMinorVersion } from './app-version.js';
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
export const OCEAN_BRAIN_MCP_VERSION_HEADER = 'X-Ocean-Brain-MCP-Version';

const readMcpVersion = (req: Request) => {
    const value = req.headers[OCEAN_BRAIN_MCP_VERSION_HEADER.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
};

export const isMcpVersionCompatible = (serverVersion: string, mcpVersion: string) => {
    const server = parseMajorMinorVersion(serverVersion);
    const mcp = parseMajorMinorVersion(mcpVersion);

    return Boolean(server && mcp && server.major === mcp.major && server.minor === mcp.minor);
};

const createMcpVersionCompatibilityMessage = (serverVersion: string, mcpVersion: string | undefined) => {
    const mcpVersionText = mcpVersion ? `v${mcpVersion}` : 'not provided';

    return [
        'Ocean Brain MCP and server versions are incompatible.',
        `Server: v${serverVersion}`,
        `MCP: ${mcpVersionText}`,
        '',
        'Please update Ocean Brain MCP to match the server minor version.',
        getOceanBrainVersionInfo().releaseUrl,
    ].join('\n');
};

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

            const versionInfo = getOceanBrainVersionInfo();
            const mcpVersion = readMcpVersion(req);

            if (!mcpVersion || !isMcpVersionCompatible(versionInfo.version, mcpVersion)) {
                res.status(426)
                    .set(JSON_HEADERS)
                    .json({
                        code: 'MCP_VERSION_INCOMPATIBLE',
                        message: createMcpVersionCompatibilityMessage(versionInfo.version, mcpVersion),
                        serverVersion: versionInfo.version,
                        mcpVersion: mcpVersion ?? null,
                        requiredMcpVersion: versionInfo.mcpVersionRequirement,
                        releaseUrl: versionInfo.releaseUrl,
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
