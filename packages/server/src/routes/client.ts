import express, { Router } from 'express';
import path from 'path';
import { isAuthenticatedRequest } from '../modules/auth-guard.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import { paths } from '../paths.js';

const shouldBlockClientRoute = (authConfig: AuthConfig, requestPath: string, authenticated: boolean) => {
    if (authConfig.mode !== 'password' || authenticated) {
        return false;
    }

    if (requestPath.startsWith('/api') || requestPath.startsWith('/graphql') || requestPath.startsWith('/auth')) {
        return false;
    }

    return path.extname(requestPath) === '';
};

export const createClientRouter = (authConfig: AuthConfig) =>
    Router()
        .use('/assets/images', express.static(paths.imageDir))
        .use((req, res, next) => {
            if (shouldBlockClientRoute(authConfig, req.path, isAuthenticatedRequest(req))) {
                const redirectPath = encodeURIComponent(req.originalUrl || '/');
                res.redirect(303, `/auth/login?next=${redirectPath}`);
                return;
            }

            next();
        })
        .use(express.static(paths.clientDist, { extensions: ['html'] }))
        .get(/.*/, (_req, res) => {
            res.sendFile(paths.clientIndex);
        });
