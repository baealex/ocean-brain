import crypto from 'crypto';
import type { Request } from 'express';
import type { AuthConfig } from '~/modules/auth-mode.js';
import { createAppError } from '~/modules/error-handler.js';

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

export const compareSharedSecret = (expected: string, received: string) => {
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const receivedBuffer = Buffer.from(received, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

export const buildSessionResponse = (authConfig: AuthConfig, req: Request) => ({
    mode: authConfig.mode,
    authRequired: authConfig.mode === 'password',
    authenticated: authConfig.mode === 'password' ? Boolean(req.session?.authenticated) : false,
});

export const assertPasswordLoginAvailable = (authConfig: AuthConfig) => {
    if (authConfig.mode !== 'password' || !authConfig.password) {
        throw createAppError(409, 'AUTH_DISABLED', 'Login is unavailable while auth mode is disabled.');
    }

    return authConfig.password;
};

export const regenerateSession = async (req: Request) => {
    await new Promise<void>((resolve, reject) => {
        req.session.regenerate((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
};

export const destroySession = async (req: Request) => {
    if (!req.session) {
        return;
    }

    await new Promise<void>((resolve, reject) => {
        req.session.destroy((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
};

export const sanitizeRedirectPath = (value: unknown) => {
    if (typeof value !== 'string' || value.length === 0) {
        return '/';
    }

    if (value.startsWith('/')) {
        if (
            value.startsWith('//') ||
            value === '/login' ||
            value.startsWith('/login?') ||
            value === '/logout' ||
            value.startsWith('/logout?')
        ) {
            return '/';
        }

        return value;
    }

    try {
        const redirectUrl = new URL(value);
        const hostname = redirectUrl.hostname.toLowerCase();

        if (!['http:', 'https:'].includes(redirectUrl.protocol)) {
            return '/';
        }

        if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) {
            return '/';
        }

        if (redirectUrl.pathname === '/login' || redirectUrl.pathname === '/logout') {
            return '/';
        }

        return `${redirectUrl.origin}${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
    } catch {
        return '/';
    }
};
