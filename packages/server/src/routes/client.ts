import express, { type RequestHandler, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import { createCsrfProtection, isAuthenticatedRequest } from '../modules/auth-guard.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import { paths } from '../paths.js';

const IMAGE_ASSET_RATE_LIMIT_MESSAGE = 'Too many image asset requests. Please try again later.';

const shouldBlockClientRoute = (authConfig: AuthConfig, requestPath: string, authenticated: boolean) => {
    if (authConfig.mode !== 'password' || authenticated) {
        return false;
    }

    if (
        requestPath.startsWith('/api') ||
        requestPath.startsWith('/graphql') ||
        requestPath === '/login' ||
        requestPath === '/logout'
    ) {
        return false;
    }

    return path.extname(requestPath) === '';
};

const createImageAssetAuthRateLimit = (authConfig: AuthConfig) =>
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => authConfig.mode !== 'password' || isAuthenticatedRequest(req),
        handler: (_req, res) => {
            res.setHeader('Cache-Control', 'no-store');
            res.status(429).json({
                code: 'IMAGE_ASSET_RATE_LIMITED',
                message: IMAGE_ASSET_RATE_LIMIT_MESSAGE,
            });
        },
    });

const createProtectedImageAssetsMiddleware = (authConfig: AuthConfig): RequestHandler => {
    return (req, res, next) => {
        if (authConfig.mode !== 'password' || isAuthenticatedRequest(req)) {
            next();
            return;
        }

        res.setHeader('Cache-Control', 'no-store');

        if (req.headers.accept?.includes('text/html')) {
            const redirectPath = encodeURIComponent(req.originalUrl || req.url || '/');
            res.redirect(303, `/login?next=${redirectPath}`);
            return;
        }

        res.status(401).end();
    };
};

const createClientRouteCsrfTokenMiddleware = (authConfig: AuthConfig) => {
    const csrfProtection = createCsrfProtection(authConfig);

    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (path.extname(req.path) !== '') {
            next();
            return;
        }

        csrfProtection(req, res, next);
    };
};

export const createClientRouter = (authConfig: AuthConfig) =>
    Router()
        .use(
            '/assets/images',
            createImageAssetAuthRateLimit(authConfig),
            createProtectedImageAssetsMiddleware(authConfig),
            express.static(paths.imageDir, {
                setHeaders: (res) => {
                    res.setHeader('X-Content-Type-Options', 'nosniff');

                    if (authConfig.mode === 'password') {
                        res.setHeader('Cache-Control', 'no-store');
                    }
                },
            }),
            (_req, res) => {
                res.setHeader('X-Content-Type-Options', 'nosniff');

                if (authConfig.mode === 'password') {
                    res.setHeader('Cache-Control', 'no-store');
                }

                res.status(404).end();
            },
        )
        .use((req, res, next) => {
            if (shouldBlockClientRoute(authConfig, req.path, isAuthenticatedRequest(req))) {
                const redirectPath = encodeURIComponent(req.originalUrl || '/');
                res.redirect(303, `/login?next=${redirectPath}`);
                return;
            }

            next();
        })
        .use(createClientRouteCsrfTokenMiddleware(authConfig))
        .use(express.static(paths.clientDist, { extensions: ['html'] }))
        .get(/.*/, (_req, res) => {
            res.sendFile(paths.clientIndex);
        });
