import type { Request } from 'express';

import type { Controller } from '~/types/index.js';
import { compareSharedSecret } from '~/modules/auth.js';
import type { AuthConfig } from '~/modules/auth-mode.js';

const buildSessionResponse = (authConfig: AuthConfig, req: Request) => ({
    mode: authConfig.mode,
    authRequired: authConfig.mode === 'password',
    authenticated: authConfig.mode === 'password' ? Boolean(req.session?.authenticated) : false
});

const regenerateSession = async (req: Request) => {
    await new Promise<void>((resolve, reject) => {
        req.session.regenerate((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
};

const destroySession = async (req: Request) => {
    if (!req.session) {
        return;
    }

    await new Promise<void>((resolve, reject) => {
        req.session.destroy((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
};

const sanitizeRedirectPath = (value: unknown) => {
    if (typeof value !== 'string' || value.length === 0) {
        return '/';
    }

    if (value.startsWith('/')) {
        if (value.startsWith('//') || value.startsWith('/auth/login')) {
            return '/';
        }

        return value;
    }

    try {
        const redirectUrl = new URL(value);
        const hostname = redirectUrl.hostname.toLowerCase();

        if (!['http:', 'https:'].includes(redirectUrl.protocol)) {
            return '/';
        }

        if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) {
            return '/';
        }

        if (redirectUrl.pathname.startsWith('/auth/login')) {
            return '/';
        }

        return `${redirectUrl.origin}${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
    } catch {
        return '/';
    }
};

const escapeHtml = (value: string) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;');

const renderLoginPage = ({
    nextPath,
    errorMessage
}: {
    nextPath: string;
    errorMessage?: string;
}) => {
    const escapedNextPath = escapeHtml(nextPath);
    const escapedErrorMessage = errorMessage ? escapeHtml(errorMessage) : '';

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ocean Brain Sign In</title>
    <style>
        :root {
            color-scheme: light;
            font-family: "Segoe UI", sans-serif;
            background: #f5f1e8;
            color: #1f2937;
        }
        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background:
                radial-gradient(circle at top, rgba(245, 158, 11, 0.22), transparent 36%),
                linear-gradient(180deg, #f6f0e4 0%, #efe4cf 100%);
        }
        .card {
            width: min(420px, calc(100vw - 32px));
            padding: 28px;
            border: 2px solid #8b6f47;
            border-radius: 20px 8px 22px 10px / 10px 18px 10px 22px;
            background: rgba(255, 250, 240, 0.96);
            box-shadow: 8px 8px 0 rgba(107, 70, 27, 0.18);
        }
        h1 {
            margin: 0 0 10px;
            font-size: 28px;
        }
        p {
            margin: 0 0 16px;
            line-height: 1.5;
            color: #4b5563;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-size: 14px;
            font-weight: 700;
        }
        input {
            width: 100%;
            box-sizing: border-box;
            margin-bottom: 16px;
            padding: 12px 14px;
            border: 2px solid #c7b08a;
            border-radius: 12px 4px 13px 3px / 4px 10px 4px 12px;
            background: #fffdf7;
            font-size: 16px;
        }
        button {
            width: 100%;
            border: 2px solid #6b461b;
            border-radius: 12px 4px 13px 3px / 4px 10px 4px 12px;
            background: #d97706;
            color: #fff7ed;
            padding: 12px 16px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
        }
        .error {
            margin-bottom: 16px;
            padding: 12px 14px;
            border: 2px solid #dc2626;
            border-radius: 12px 4px 13px 3px / 4px 10px 4px 12px;
            background: #fef2f2;
            color: #991b1b;
            font-size: 14px;
            font-weight: 700;
        }
    </style>
</head>
<body>
    <main class="card">
        <h1>Protected Workspace</h1>
        <p>Password mode is enabled. Sign in before Ocean Brain serves the app.</p>
        ${escapedErrorMessage ? `<div class="error">${escapedErrorMessage}</div>` : ''}
        <form method="post" action="/auth/login">
            <input type="hidden" name="next" value="${escapedNextPath}" />
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required />
            <button type="submit">Sign in</button>
        </form>
    </main>
</body>
</html>`;
};

export const createLoginHandler = (authConfig: AuthConfig): Controller => {
    return async (req, res) => {
        if (authConfig.mode !== 'password' || !authConfig.password) {
            res.status(409).json({
                code: 'AUTH_DISABLED',
                message: 'Login is unavailable while auth mode is disabled.'
            }).end();
            return;
        }

        const password = typeof req.body?.password === 'string'
            ? req.body.password
            : '';

        if (!password || !compareSharedSecret(authConfig.password, password)) {
            res.status(401).json({
                code: 'UNAUTHORIZED',
                message: 'Invalid password'
            }).end();
            return;
        }

        await regenerateSession(req);
        req.session.authenticated = true;

        res.status(200).json(buildSessionResponse(authConfig, req)).end();
    };
};

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

        const password = typeof req.body?.password === 'string'
            ? req.body.password
            : '';

        if (!password || !compareSharedSecret(authConfig.password, password)) {
            res
                .status(401)
                .type('html')
                .send(renderLoginPage({
                    nextPath,
                    errorMessage: 'Invalid password'
                }))
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
            res.redirect(303, '/auth/login');
            return;
        }

        res.redirect(303, '/');
    };
};

export const createLogoutHandler = (authConfig: AuthConfig): Controller => {
    return async (req, res) => {
        if (authConfig.mode === 'password') {
            await destroySession(req);
        }

        res.status(200).json({
            mode: authConfig.mode,
            authRequired: authConfig.mode === 'password',
            authenticated: false
        }).end();
    };
};

export const createSessionStatusHandler = (authConfig: AuthConfig): Controller => {
    return async (req, res) => {
        res.status(200).json(buildSessionResponse(authConfig, req)).end();
    };
};
