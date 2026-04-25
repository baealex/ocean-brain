import type { AuthConfig } from '~/modules/auth-mode.js';
import type { Controller } from '~/types/index.js';
import { compareSharedSecret, destroySession, regenerateSession, sanitizeRedirectPath } from '../service.js';
import { renderLoginPage } from './login-page.js';

export const createLoginPageHandler = (authConfig: AuthConfig): Controller => {
    return async (req, res) => {
        if (authConfig.mode !== 'password' || req.session?.authenticated) {
            res.redirect(303, sanitizeRedirectPath(req.query.next));
            return;
        }

        const nextPath = sanitizeRedirectPath(req.query.next);
        res.status(200).type('html').send(renderLoginPage({ nextPath })).end();
    };
};

export const createLoginPageSubmitHandler = (authConfig: AuthConfig): Controller => {
    return async (req, res) => {
        const nextPath = sanitizeRedirectPath(req.body?.next);

        if (authConfig.mode !== 'password' || !authConfig.password) {
            res.redirect(303, nextPath);
            return;
        }

        const password = typeof req.body?.password === 'string' ? req.body.password : '';

        if (!password || !compareSharedSecret(authConfig.password, password)) {
            res.status(401)
                .type('html')
                .send(
                    renderLoginPage({
                        nextPath,
                        errorMessage: 'Invalid password',
                    }),
                )
                .end();
            return;
        }

        await regenerateSession(req);
        req.session.authenticated = true;

        res.redirect(303, nextPath);
    };
};

export const createLogoutPageHandler = (authConfig: AuthConfig): Controller => {
    return async (req, res) => {
        if (authConfig.mode === 'password') {
            await destroySession(req);
            res.redirect(303, '/login');
            return;
        }

        res.redirect(303, '/');
    };
};
