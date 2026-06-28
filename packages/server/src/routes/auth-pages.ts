import { Router } from 'express';
import {
    createLoginPageHandler,
    createLoginPageSubmitHandler,
    createLogoutPageHandler,
} from '../features/auth/http/pages.js';
import { createCsrfProtection, createLoginCsrfFailureHandler, requireSessionForWrite } from '../modules/auth-guard.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import { createAuthAttemptRateLimit, createSessionAccessRateLimit } from '../modules/rate-limit.js';

export const createAuthPagesRouter = (authConfig: AuthConfig) => {
    const csrfProtection = createCsrfProtection(authConfig);
    const sessionAccessRateLimit = createSessionAccessRateLimit();

    return Router()
        .get('/login', csrfProtection, createLoginPageHandler(authConfig))
        .post('/login', csrfProtection, createAuthAttemptRateLimit(), createLoginPageSubmitHandler(authConfig))
        .post(
            '/logout',
            sessionAccessRateLimit,
            requireSessionForWrite(authConfig),
            csrfProtection,
            createLogoutPageHandler(authConfig),
        )
        .use(createLoginCsrfFailureHandler(authConfig));
};
