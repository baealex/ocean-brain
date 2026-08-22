import { buildAuthSessionResponse } from '@baejino/auth';
import { compareSharedSecret as compareCommonSharedSecret } from '@baejino/auth/crypto';
import crypto from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { issueCsrfToken } from '~/modules/auth-guard.js';
import type { AuthConfig } from '~/modules/auth-mode.js';
import { sanitizeRedirectPath } from '~/modules/auth-redirect.js';
import { createAppError } from '~/modules/error-handler.js';

export const AUTH_SESSION_GENERATION_HEADER = 'X-Ocean-Brain-Session-Generation';
const AUTH_SESSION_GENERATION = crypto.randomUUID();

export const getSessionGeneration = () => AUTH_SESSION_GENERATION;

export const createPasswordHash = async (password: string) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
};

export const comparePassword = async (password: string, storedHash: string) => {
    const [salt, hash] = storedHash.split(':');
    const newHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === newHash;
};

export const compareSharedSecret = compareCommonSharedSecret;

export const buildSessionResponse = (authConfig: AuthConfig, req: FastifyRequest) =>
    buildAuthSessionResponse(authConfig, Boolean(req.session?.authenticated));

export const setSessionStatusHeaders = (reply: FastifyReply) => {
    reply.header(AUTH_SESSION_GENERATION_HEADER, getSessionGeneration());
    reply.header('Cache-Control', 'no-store');
};

export const refreshCsrfToken = (authConfig: AuthConfig, reply: FastifyReply) => issueCsrfToken(authConfig, reply);

export const assertPasswordLoginAvailable = (authConfig: AuthConfig) => {
    if (authConfig.mode !== 'password') {
        throw createAppError(409, 'AUTH_OPEN_MODE', 'Login is unavailable while auth mode is open.');
    }

    return authConfig.password;
};

export const regenerateSession = async (req: FastifyRequest) => req.session.regenerate();

export const destroySession = async (req: FastifyRequest) => {
    if (!req.session) {
        return;
    }

    await req.session.destroy();
};

export { sanitizeRedirectPath };
