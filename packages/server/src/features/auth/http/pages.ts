import { issueCsrfToken } from '~/modules/auth-guard.js';
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

const setLoginPageHeaders = (reply: Parameters<Controller>[1]) => {
    reply.header('Cache-Control', 'no-store');
};

export const createLoginPageHandler = (authConfig: AuthConfig): Controller => {
    return async (req, reply) => {
        if (authConfig.mode !== 'password' || req.session?.authenticated) {
            setLoginPageHeaders(reply);
            return reply.redirect(sanitizeRedirectPath(req.query.next), 303);
        }

        const nextPath = sanitizeRedirectPath(req.query.next);
        const csrfToken = issueCsrfToken(authConfig, reply);
        setLoginPageHeaders(reply);
        return reply
            .status(200)
            .type('text/html; charset=utf-8')
            .send(
                renderLoginPage({
                    nextPath,
                    csrfToken,
                    sessionGeneration: getSessionGeneration(),
                }),
            );
    };
};

export const createLoginPageSubmitHandler = (authConfig: AuthConfig): Controller => {
    return async (req, reply) => {
        const nextPath = sanitizeRedirectPath(req.body?.next);

        if (authConfig.mode !== 'password' || !authConfig.password) {
            setLoginPageHeaders(reply);
            return reply.redirect(nextPath, 303);
        }

        const password = typeof req.body?.password === 'string' ? req.body.password : '';

        if (!password || !compareSharedSecret(authConfig.password, password)) {
            const csrfToken = issueCsrfToken(authConfig, reply);
            setLoginPageHeaders(reply);
            return reply
                .status(401)
                .type('text/html; charset=utf-8')
                .send(
                    renderLoginPage({
                        nextPath,
                        errorMessage: 'Invalid password',
                        csrfToken,
                        sessionGeneration: getSessionGeneration(),
                    }),
                );
        }

        await regenerateSession(req);
        req.session.authenticated = true;
        refreshCsrfToken(authConfig, reply);

        setLoginPageHeaders(reply);
        return reply.redirect(nextPath, 303);
    };
};

export const createLogoutPageHandler = (authConfig: AuthConfig): Controller => {
    return async (req, reply) => {
        if (authConfig.mode === 'password') {
            await destroySession(req);
            setLoginPageHeaders(reply);
            return reply.redirect('/login', 303);
        }

        setLoginPageHeaders(reply);
        return reply.redirect('/', 303);
    };
};
