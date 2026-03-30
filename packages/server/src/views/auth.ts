import type { Request } from 'express';

import type { Controller } from '~/types/index.js';
import { compareSharedSecret } from '~/modules/auth.js';
import type { AuthConfig } from '~/modules/auth-mode.js';

const buildSessionResponse = (authConfig: AuthConfig, req: Request) => ({
    mode: authConfig.mode,
    authRequired: authConfig.mode === 'password',
    authenticated: authConfig.mode === 'password' ? Boolean(req.session?.authenticated) : false
});

const regenerateSession = async (req: Request) => {
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

const destroySession = async (req: Request) => {
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

export const createLoginHandler = (authConfig: AuthConfig): Controller => {
    return async (req, res) => {
        if (authConfig.mode !== 'password' || !authConfig.password) {
            res.status(409).json({
                code: 'AUTH_DISABLED',
                message: 'Login is unavailable while auth mode is disabled.'
            }).end();
            return;
        }

        const password = typeof req.body?.password === 'string'
            ? req.body.password
            : '';

        if (!password || !compareSharedSecret(authConfig.password, password)) {
            res.status(401).json({
                code: 'UNAUTHORIZED',
                message: 'Invalid password'
            }).end();
            return;
        }

        await regenerateSession(req);
        req.session.authenticated = true;

        res.status(200).json(buildSessionResponse(authConfig, req)).end();
    };
};

export const createLogoutHandler = (authConfig: AuthConfig): Controller => {
    return async (req, res) => {
        if (authConfig.mode === 'password') {
            await destroySession(req);
        }

        res.status(200).json({
            mode: authConfig.mode,
            authRequired: authConfig.mode === 'password',
            authenticated: false
        }).end();
    };
};

export const createSessionStatusHandler = (authConfig: AuthConfig): Controller => {
    return async (req, res) => {
        res.status(200).json(buildSessionResponse(authConfig, req)).end();
    };
};
