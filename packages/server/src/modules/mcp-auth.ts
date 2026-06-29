import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ValidationRule } from 'graphql';
import { GraphQLError } from 'graphql';

import {
    getOceanBrainVersionInfo,
    OCEAN_BRAIN_MCP_CLIENT_VERSION_HEADER,
    OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION_HEADER,
    parseMajorMinorVersion,
} from './app-version.js';
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

const readHeaderValue = (req: Request, headerName: string) => {
    const value = req.headers[headerName.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
};

const readMcpCompatibilityVersion = (req: Request) =>
    readHeaderValue(req, OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION_HEADER) ??
    readHeaderValue(req, OCEAN_BRAIN_MCP_VERSION_HEADER);

const readMcpClientVersion = (req: Request) =>
    readHeaderValue(req, OCEAN_BRAIN_MCP_CLIENT_VERSION_HEADER) ?? readHeaderValue(req, OCEAN_BRAIN_MCP_VERSION_HEADER);

export const isMcpVersionCompatible = (requiredMcpCompatibilityVersion: string, mcpCompatibilityVersion: string) => {
    const required = parseMajorMinorVersion(requiredMcpCompatibilityVersion);
    const mcp = parseMajorMinorVersion(mcpCompatibilityVersion);

    return Boolean(required && mcp && required.major === mcp.major && required.minor === mcp.minor);
};

const createMcpVersionCompatibilityMessage = ({
    mcpClientVersion,
    mcpCompatibilityVersion,
    requiredMcpCompatibilityVersion,
    serverVersion,
}: {
    mcpClientVersion?: string;
    mcpCompatibilityVersion?: string;
    requiredMcpCompatibilityVersion: string;
    serverVersion: string;
}) => {
    const mcpCompatibilityVersionText = mcpCompatibilityVersion ? `v${mcpCompatibilityVersion}` : 'not provided';
    const mcpClientVersionText = mcpClientVersion ? `v${mcpClientVersion}` : 'not provided';

    return [
        'Ocean Brain MCP compatibility versions are incompatible.',
        `Server: v${serverVersion}`,
        `Required MCP compatibility: ${requiredMcpCompatibilityVersion}`,
        `MCP compatibility: ${mcpCompatibilityVersionText}`,
        `MCP client: ${mcpClientVersionText}`,
        '',
        'Please update Ocean Brain MCP to a compatible release.',
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
            const mcpCompatibilityVersion = readMcpCompatibilityVersion(req);
            const mcpClientVersion = readMcpClientVersion(req);

            if (
                !mcpCompatibilityVersion ||
                !isMcpVersionCompatible(versionInfo.mcp.compatibilityVersion, mcpCompatibilityVersion)
            ) {
                res.status(426)
                    .set(JSON_HEADERS)
                    .json({
                        code: 'MCP_VERSION_INCOMPATIBLE',
                        message: createMcpVersionCompatibilityMessage({
                            serverVersion: versionInfo.version,
                            requiredMcpCompatibilityVersion: versionInfo.mcp.compatibilityRequirement,
                            mcpCompatibilityVersion,
                            mcpClientVersion,
                        }),
                        serverVersion: versionInfo.version,
                        mcpVersion: mcpClientVersion ?? mcpCompatibilityVersion ?? null,
                        mcpClientVersion: mcpClientVersion ?? null,
                        mcpCompatibilityVersion: mcpCompatibilityVersion ?? null,
                        requiredMcpVersion: versionInfo.mcpVersionRequirement,
                        requiredMcpCompatibilityVersion: versionInfo.mcp.compatibilityRequirement,
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
