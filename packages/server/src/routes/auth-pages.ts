import { Router } from 'express';
import {
    createLoginPageHandler,
    createLoginPageSubmitHandler,
    createLogoutPageHandler,
} from '../features/auth/http/pages.js';
import type { AuthConfig } from '../modules/auth-mode.js';

export const createAuthPagesRouter = (authConfig: AuthConfig) =>
    Router()
        .get('/login', createLoginPageHandler(authConfig))
        .post('/login', createLoginPageSubmitHandler(authConfig))
        .post('/logout', createLogoutPageHandler(authConfig));
