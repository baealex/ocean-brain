import type { FastifyPluginAsync } from 'fastify';
import {
    createLoginPageHandler,
    createLoginPageSubmitHandler,
    createLogoutPageHandler,
} from '../features/auth/http/pages.js';
import { createCsrfProtection, requireSessionForWrite } from '../modules/auth-guard.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import { createAuthAttemptRateLimit, createSessionAccessRateLimit } from '../modules/rate-limit.js';
import type { HttpRoute } from '../types/index.js';

export const createAuthPagesRouter = (authConfig: AuthConfig): FastifyPluginAsync => {
    return async (app) => {
        const csrfProtection = createCsrfProtection(authConfig);

        app.get<HttpRoute>('/login', createLoginPageHandler(authConfig));
        app.post<HttpRoute>(
            '/login',
            {
                preHandler: csrfProtection,
                config: { rateLimit: createAuthAttemptRateLimit() },
            },
            createLoginPageSubmitHandler(authConfig),
        );
        app.post<HttpRoute>(
            '/logout',
            {
                preHandler: [requireSessionForWrite(authConfig), csrfProtection],
                config: { rateLimit: createSessionAccessRateLimit() },
            },
            createLogoutPageHandler(authConfig),
        );
    };
};
