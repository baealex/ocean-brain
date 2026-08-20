import type { RateLimitOptions } from '@fastify/rate-limit';
import type { FastifyRequest } from 'fastify';
import { isAuthenticatedRequest } from './auth-guard.js';
import type { AuthConfig } from './auth-mode.js';
import { createAppError } from './error-handler.js';

const AUTH_RATE_LIMIT_MESSAGE = 'Too many authentication attempts. Please try again later.';
const SESSION_ACCESS_RATE_LIMIT_MESSAGE = 'Too many authenticated requests. Please try again later.';
const IMAGE_ASSET_RATE_LIMIT_MESSAGE = 'Too many image asset requests. Please try again later.';

const createOptions = (
    max: number,
    timeWindow: number,
    code: string,
    message: string,
    options: Pick<RateLimitOptions, 'allowList' | 'groupId'> = {},
): RateLimitOptions => ({
    max,
    timeWindow,
    hook: 'preHandler',
    enableDraftSpec: true,
    errorResponseBuilder: (_request, context) => createAppError(context.statusCode, code, message),
    ...options,
});

export const createAuthAttemptRateLimit = () =>
    createOptions(10, 15 * 60 * 1000, 'AUTH_RATE_LIMITED', AUTH_RATE_LIMIT_MESSAGE, {
        groupId: 'auth-attempt',
    });

export const createSessionAccessRateLimit = () =>
    createOptions(300, 60 * 1000, 'SESSION_RATE_LIMITED', SESSION_ACCESS_RATE_LIMIT_MESSAGE, {
        groupId: 'session-access',
    });

export const createImageAssetRateLimit = (authConfig: AuthConfig) =>
    ({
        ...createOptions(10, 15 * 60 * 1000, 'IMAGE_ASSET_RATE_LIMITED', IMAGE_ASSET_RATE_LIMIT_MESSAGE, {
            groupId: 'image-asset',
            allowList: (request: FastifyRequest) => authConfig.mode !== 'password' || isAuthenticatedRequest(request),
        }),
        hook: 'onRequest',
    }) satisfies RateLimitOptions;
