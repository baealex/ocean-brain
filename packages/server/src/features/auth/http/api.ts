import { buildAuthSessionResponse } from '@baejino/auth';
import type { AuthConfig } from '~/modules/auth-mode.js';
import { createAppError } from '~/modules/error-handler.js';
import type { Controller } from '~/types/index.js';
import {
    assertPasswordLoginAvailable,
    buildSessionResponse,
    compareSharedSecret,
    destroySession,
    regenerateSession,
} from '../service.js';

export const createLoginHandler = (authConfig: AuthConfig): Controller => {
    return async (req, res) => {
        const expectedPassword = assertPasswordLoginAvailable(authConfig);
        const password = typeof req.body?.password === 'string' ? req.body.password : '';

        if (!password || !compareSharedSecret(expectedPassword, password)) {
            throw createAppError(401, 'UNAUTHORIZED', 'Invalid password');
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

        res.status(200).json(buildAuthSessionResponse(authConfig, false)).end();
    };
};

export const createSessionStatusHandler = (authConfig: AuthConfig): Controller => {
    return async (req, res) => {
        res.status(200).json(buildSessionResponse(authConfig, req)).end();
    };
};
