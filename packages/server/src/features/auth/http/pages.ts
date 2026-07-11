import type { AuthConfig } from '~/modules/auth-mode.js';
import type { Controller } from '~/types/index.js';
import {
    compareSharedSecret,
    destroySession,
    getSessionGeneration,
    refreshCsrfToken,
    regenerateSession,
    sanitizeRedirectPath,
} from '../service.js';
import { renderLoginPage } from './login-page.js';

const setLoginPageHeaders = (res: Parameters<Controller>[1]) => {
    res.set('Cache-Control', 'no-store');
};

export const createLoginPageHandler = (authConfig: AuthConfig): Controller => {
    return async (req, res) => {
        if (authConfig.mode !== 'password' || req.session?.authenticated) {
            setLoginPageHeaders(res);
            res.redirect(303, sanitizeRedirectPath(req.query.next));
            return;
        }

        const nextPath = sanitizeRedirectPath(req.query.next);
        setLoginPageHeaders(res);
        res.status(200)
            .type('html')
            .send(
                renderLoginPage({
                    nextPath,
                    csrfToken: res.locals._csrf,
                    sessionGeneration: getSessionGeneration(),
                }),
            )
            .end();
    };
};

export const createLoginPageSubmitHandler = (authConfig: AuthConfig): Controller => {
    return async (req, res) => {
        const nextPath = sanitizeRedirectPath(req.body?.next);

        if (authConfig.mode !== 'password' || !authConfig.password) {
            setLoginPageHeaders(res);
            res.redirect(303, nextPath);
            return;
        }

        const password = typeof req.body?.password === 'string' ? req.body.password : '';

        if (!password || !compareSharedSecret(authConfig.password, password)) {
            setLoginPageHeaders(res);
            res.status(401)
                .type('html')
                .send(
                    renderLoginPage({
                        nextPath,
                        errorMessage: 'Invalid password',
                        csrfToken: res.locals._csrf,
                        sessionGeneration: getSessionGeneration(),
                    }),
                )
                .end();
            return;
        }

        await regenerateSession(req);
        req.session.authenticated = true;
        refreshCsrfToken(req);

        setLoginPageHeaders(res);
        res.redirect(303, nextPath);
    };
};

export const createLogoutPageHandler = (authConfig: AuthConfig): Controller => {
    return async (req, res) => {
        if (authConfig.mode === 'password') {
            await destroySession(req);
            setLoginPageHeaders(res);
            res.redirect(303, '/login');
            return;
        }

        setLoginPageHeaders(res);
        res.redirect(303, '/');
    };
};
