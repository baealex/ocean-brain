import express from 'express';
import { createHandler } from 'graphql-http/lib/use/express';

import logger from './modules/logger.js';
import { paths } from './paths.js';
import schema from './schema/index.js';
import { createApiRouter } from './urls.js';
import { createMutationAuthValidationRule, createSessionMiddleware, isAuthenticatedRequest } from './modules/auth-guard.js';
import type { AuthConfig } from './modules/auth-mode.js';

export const createApp = (authConfig: AuthConfig) => {
    const app = express();
    app.locals.authConfig = authConfig;

    app.use(logger)
        .use(express.static(paths.clientDist, { extensions: ['html'] }))
        .use('/assets/images/', express.static(paths.imageDir))
        .use(createSessionMiddleware(authConfig))
        .use(express.json({ limit: '50mb' }))
        .use('/api', createApiRouter(authConfig))
        .use('/graphql', createHandler({
            schema,
            context: (req) => ({
                authMode: authConfig.mode,
                isAuthenticated: isAuthenticatedRequest(req.raw),
                req: req.raw,
                res: req.context.res
            }),
            validationRules: (req, _args, specifiedRules) => {
                if (authConfig.mode === 'disabled' || isAuthenticatedRequest(req.raw)) {
                    return specifiedRules;
                }

                return [...specifiedRules, createMutationAuthValidationRule()];
            }
        }))
        .get(/.*/, (_req, res) => {
            res.sendFile(paths.clientIndex);
        });

    return app;
};

export default createApp;
