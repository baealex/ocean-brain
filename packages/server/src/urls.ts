import { Router } from 'express';
import * as views from './views/index.js';
import useAsync from './modules/use-async.js';
import { requireSessionForWrite } from './modules/auth-guard.js';
import type { AuthConfig } from './modules/auth-mode.js';

export const createApiRouter = (authConfig: AuthConfig) => Router()
    .post('/auth/login', useAsync(views.createLoginHandler(authConfig)))
    .post('/auth/logout', useAsync(views.createLogoutHandler(authConfig)))
    .get('/auth/session', useAsync(views.createSessionStatusHandler(authConfig)))
    .post('/image', requireSessionForWrite(authConfig), useAsync(views.uploadImage))
    .post('/image-from-src', requireSessionForWrite(authConfig), useAsync(views.uploadImageFromSrc));
