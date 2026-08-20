import { buildAuthSessionResponse } from '@baejino/auth';
import type { AuthConfig } from '~/modules/auth-mode.js';
import { createAppError } from '~/modules/error-handler.js';
import type { Controller } from '~/types/index.js';
import {
    assertPasswordLoginAvailable,
    buildSessionResponse,
    compareSharedSecret,
    destroySession,
    refreshCsrfToken,
    regenerateSession,
    setSessionStatusHeaders,
} from '../service.js';

export const createLoginHandler = (authConfig: AuthConfig): Controller => {
    return async (req, reply) => {
        const expectedPassword = assertPasswordLoginAvailable(authConfig);
        const password = typeof req.body?.password === 'string' ? req.body.password : '';

        if (!password || !compareSharedSecret(expectedPassword, password)) {
            throw createAppError(401, 'UNAUTHORIZED', 'Invalid password');
        }

        await regenerateSession(req);
        req.session.authenticated = true;
        refreshCsrfToken(authConfig, reply);

        return reply.status(200).send(buildSessionResponse(authConfig, req));
    };
};

export const createLogoutHandler = (authConfig: AuthConfig): Controller => {
    return async (req, reply) => {
        if (authConfig.mode === 'password') {
            await destroySession(req);
        }

        return reply.status(200).send(buildAuthSessionResponse(authConfig, false));
    };
};

export const createSessionStatusHandler = (authConfig: AuthConfig): Controller => {
    return async (req, reply) => {
        setSessionStatusHeaders(reply);
        refreshCsrfToken(authConfig, reply);
        return reply.status(200).send(buildSessionResponse(authConfig, req));
    };
};
