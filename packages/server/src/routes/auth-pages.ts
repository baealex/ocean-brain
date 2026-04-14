import { Router } from 'express';
import type { AuthConfig } from '../modules/auth-mode.js';
import { createLoginPageHandler, createLoginPageSubmitHandler, createLogoutPageHandler } from '../views/auth.js';

export const createAuthPagesRouter = (authConfig: AuthConfig) =>
    Router()
        .get('/login', createLoginPageHandler(authConfig))
        .post('/login', createLoginPageSubmitHandler(authConfig))
        .post('/logout', createLogoutPageHandler(authConfig));
