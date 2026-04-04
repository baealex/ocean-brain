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
            font-family: "Pretendard Variable", "Segoe UI", sans-serif;
            background: #eef2f6;
            color: #111827;
        }
        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background:
                radial-gradient(circle at top, rgba(148, 163, 184, 0.14), transparent 34%),
                linear-gradient(180deg, #f7fafc 0%, #eef2f6 100%);
            padding: 24px;
        }
        .card {
            width: min(420px, calc(100vw - 32px));
            padding: 28px;
            border: 1px solid rgba(148, 163, 184, 0.28);
            border-radius: 22px;
            background: rgba(255, 255, 255, 0.94);
            box-shadow:
                0 24px 48px -32px rgba(15, 23, 42, 0.24),
                inset 0 1px 0 rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(10px);
        }
        .eyebrow {
            display: inline-flex;
            margin-bottom: 16px;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }
        h1 {
            margin: 0 0 10px;
            font-size: clamp(28px, 4vw, 32px);
            line-height: 1.08;
            letter-spacing: -0.03em;
        }
        p {
            margin: 0 0 22px;
            line-height: 1.6;
            color: #475569;
        }
        label {
            display: block;
            margin-bottom: 10px;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.02em;
            color: #334155;
        }
        form {
            display: grid;
            gap: 16px;
        }
        .field {
            display: grid;
        }
        input {
            width: 100%;
            box-sizing: border-box;
            padding: 14px 16px;
            border: 1px solid #cbd5e1;
            border-radius: 14px;
            background: rgba(248, 250, 252, 0.96);
            font-size: 16px;
            color: #0f172a;
            transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
        }
        input:focus {
            outline: none;
            border-color: #3b82f6;
            background: #ffffff;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.14);
        }
        .hint {
            margin-top: 10px;
            font-size: 13px;
            color: #64748b;
        }
        button {
            width: 100%;
            border: 1px solid #1d4ed8;
            border-radius: 14px;
            background: #2563eb;
            color: #eff6ff;
            padding: 14px 18px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 14px 28px -20px rgba(29, 78, 216, 0.45);
            transition: transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
        }
        button:hover {
            background: #1d4ed8;
            box-shadow: 0 18px 32px -24px rgba(29, 78, 216, 0.46);
        }
        button:active {
            transform: translateY(1px);
        }
        button:focus-visible {
            outline: none;
            box-shadow:
                0 0 0 4px rgba(59, 130, 246, 0.14),
                0 16px 28px -22px rgba(29, 78, 216, 0.42);
        }
        .error {
            margin-bottom: 18px;
            padding: 13px 14px;
            border: 1px solid rgba(239, 68, 68, 0.24);
            border-radius: 14px;
            background: rgba(254, 242, 242, 0.92);
            color: #b91c1c;
            font-size: 14px;
            font-weight: 700;
        }
        @media (max-width: 640px) {
            body {
                place-items: stretch;
                padding: 18px;
            }
            .card {
                width: auto;
                padding: 24px;
                margin: auto 0;
            }
        }
    </style>
</head>
<body>
    <main class="card">
        <div class="eyebrow">Workspace Locked</div>
        <h1>Protected Workspace</h1>
        <p>Password mode is enabled. Sign in before Ocean Brain serves the app.</p>
        ${escapedErrorMessage ? `<div class="error">${escapedErrorMessage}</div>` : ''}
        <form method="post" action="/auth/login">
            <input type="hidden" name="next" value="${escapedNextPath}" />
            <div class="field">
                <label for="password">Password</label>
                <input id="password" name="password" type="password" autocomplete="current-password" required />
            </div>
            <button type="submit">Sign in</button>
        </form>
        <div class="hint">This session must be authenticated before the workspace loads.</div>
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
