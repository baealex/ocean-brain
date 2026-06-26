import { Router } from 'express';
import {
    createLoginPageHandler,
    createLoginPageSubmitHandler,
    createLogoutPageHandler,
} from '../features/auth/http/pages.js';
import { createCsrfProtection, createLoginCsrfFailureHandler, requireSessionForWrite } from '../modules/auth-guard.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import { createAuthAttemptRateLimit } from '../modules/rate-limit.js';

export const createAuthPagesRouter = (authConfig: AuthConfig) => {
    const csrfProtection = createCsrfProtection(authConfig);

    return Router()
        .get('/login', csrfProtection, createLoginPageHandler(authConfig))
        .post('/login', csrfProtection, createAuthAttemptRateLimit(), createLoginPageSubmitHandler(authConfig))
        .post('/logout', requireSessionForWrite(authConfig), csrfProtection, createLogoutPageHandler(authConfig))
        .use(createLoginCsrfFailureHandler(authConfig));
};
