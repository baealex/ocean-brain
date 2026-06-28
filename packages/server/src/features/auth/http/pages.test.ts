import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test, { type TestContext } from 'node:test';
import { createApp } from '~/app.js';
import { AUTH_SESSION_COOKIE_NAME, type AuthConfig } from '~/modules/auth-mode.js';

const createPasswordAuthConfig = (): AuthConfig => ({
    mode: 'password',
    password: 'secret',
    sessionSecret: 'session-secret',
    cookieName: AUTH_SESSION_COOKIE_NAME,
    source: 'password',
});

const startServer = async (t: TestContext, authConfig: AuthConfig) => {
    const app = createApp(authConfig);
    const server = app.listen(0);
    let closed = false;

    await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    const close = async () => {
        if (closed) {
            return;
        }

        closed = true;

        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    };

    t.after(close);

    const address = server.address() as AddressInfo;

    return { baseUrl: `http://127.0.0.1:${address.port}`, close };
};

const getSetCookies = (headers: Headers) => {
    const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    if (typeof getSetCookie === 'function') {
        return getSetCookie.call(headers);
    }

    const setCookie = headers.get('set-cookie');
    return setCookie ? setCookie.split(/,(?=\s*[^;,]+=)/).map((cookie) => cookie.trim()) : [];
};

const toCookieHeader = (setCookies: string[]) => setCookies.map((cookie) => cookie.split(';')[0]).join('; ');

const mergeCookieHeaders = (...cookieHeaders: (string | undefined)[]) => {
    const cookies = new Map<string, string>();

    for (const cookieHeader of cookieHeaders) {
        for (const cookie of cookieHeader?.split('; ') ?? []) {
            const separatorIndex = cookie.indexOf('=');
            if (separatorIndex <= 0) continue;

            cookies.set(cookie.slice(0, separatorIndex), cookie);
        }
    }

    return Array.from(cookies.values()).join('; ');
};

const extractCsrfTokenFromHtml = (html: string) => {
    const match = html.match(/name="_csrf" value="([^"]+)"/);
    return match?.[1];
};

const extractCsrfTokenFromCookie = (cookie?: string) => {
    const token = cookie
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('XSRF-TOKEN='))
        ?.slice('XSRF-TOKEN='.length);

    return token ? decodeURIComponent(token) : undefined;
};

const formRequest = async (baseUrl: string, path: string, body: Record<string, string>, cookie?: string) => {
    const csrfToken = extractCsrfTokenFromCookie(cookie);
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        redirect: 'manual',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(cookie ? { Cookie: cookie } : {}),
            ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {}),
        },
        body: new URLSearchParams(body).toString(),
    });

    return {
        status: response.status,
        text: await response.text(),
        location: response.headers.get('location') ?? undefined,
        cookie: mergeCookieHeaders(cookie, toCookieHeader(getSetCookies(response.headers))) || undefined,
    };
};

test('password mode blocks client routes until the server-side login form succeeds', async (t) => {
    const { baseUrl } = await startServer(t, createPasswordAuthConfig());

    const blockedHome = await fetch(`${baseUrl}/`, { redirect: 'manual' });

    assert.equal(blockedHome.status, 303);
    assert.equal(blockedHome.headers.get('location'), '/login?next=%2F');

    const blockedAssetPage = await fetch(`${baseUrl}/assets/images/2026/4/15/private.png`, {
        headers: { Accept: 'text/html' },
        redirect: 'manual',
    });

    assert.equal(blockedAssetPage.status, 303);
    assert.equal(
        blockedAssetPage.headers.get('location'),
        '/login?next=%2Fassets%2Fimages%2F2026%2F4%2F15%2Fprivate.png',
    );
    assert.equal(blockedAssetPage.headers.get('cache-control'), 'no-store');

    const blockedAssetImage = await fetch(`${baseUrl}/assets/images/2026/4/15/private.png`, {
        headers: { Accept: 'image/png,image/*' },
        redirect: 'manual',
    });

    assert.equal(blockedAssetImage.status, 401);
    assert.equal(blockedAssetImage.headers.get('cache-control'), 'no-store');

    const loginPage = await fetch(`${baseUrl}/login?next=%2Fnotes`);
    const loginPageHtml = await loginPage.text();
    const loginCookie = toCookieHeader(getSetCookies(loginPage.headers));
    const csrfToken = extractCsrfTokenFromHtml(loginPageHtml);

    assert.equal(loginPage.status, 200);
    assert.match(loginPageHtml, /Ocean Brain/);
    assert.match(loginPageHtml, /Enter the workspace password to continue/);
    assert.match(loginPageHtml, /<form method="post" action="\/login">/);
    assert.match(loginPageHtml, /name="_csrf"/);
    assert.match(loginPageHtml, /name="next" value="\/notes"/);
    assert.ok(csrfToken);

    const invalidLogin = await formRequest(
        baseUrl,
        '/login',
        {
            next: '/notes',
            password: 'wrong',
            _csrf: csrfToken,
        },
        loginCookie,
    );

    assert.equal(invalidLogin.status, 401);
    assert.match(invalidLogin.text, /Invalid password/);

    const validLogin = await formRequest(
        baseUrl,
        '/login',
        {
            next: '/notes',
            password: 'secret',
            _csrf: csrfToken,
        },
        invalidLogin.cookie,
    );

    assert.equal(validLogin.status, 303);
    assert.equal(validLogin.location, '/notes');
    assert.ok(validLogin.cookie);

    const sessionStatus = await fetch(`${baseUrl}/api/auth/session`, { headers: { Cookie: validLogin.cookie } });
    const sessionCookie = mergeCookieHeaders(validLogin.cookie, toCookieHeader(getSetCookies(sessionStatus.headers)));

    assert.equal(sessionStatus.status, 200);
    assert.deepEqual(await sessionStatus.json(), {
        mode: 'password',
        authRequired: true,
        authenticated: true,
    });

    const missingAuthenticatedAsset = await fetch(`${baseUrl}/assets/images/2026/4/15/missing.png`, {
        headers: {
            Accept: 'image/png,image/*',
            Cookie: sessionCookie,
        },
    });

    assert.equal(missingAuthenticatedAsset.status, 404);
    assert.equal(missingAuthenticatedAsset.headers.get('cache-control'), 'no-store');

    const logout = await formRequest(baseUrl, '/logout', {}, sessionCookie);
    assert.equal(logout.status, 303);
    assert.equal(logout.location, '/login');
});

test('password login page rate limits repeated failed attempts', async (t) => {
    const { baseUrl } = await startServer(t, createPasswordAuthConfig());
    const loginPage = await fetch(`${baseUrl}/login?next=%2Fnotes`);
    const csrfToken = extractCsrfTokenFromHtml(await loginPage.text());
    const loginCookie = toCookieHeader(getSetCookies(loginPage.headers));

    assert.ok(csrfToken);

    for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await formRequest(
            baseUrl,
            '/login',
            {
                next: '/notes',
                password: 'wrong',
                _csrf: csrfToken,
            },
            loginCookie,
        );

        assert.equal(response.status, 401);
        assert.match(response.text, /Invalid password/);
    }

    const rateLimited = await formRequest(
        baseUrl,
        '/login',
        {
            next: '/notes',
            password: 'wrong',
            _csrf: csrfToken,
        },
        loginCookie,
    );

    assert.equal(rateLimited.status, 429);
    assert.match(rateLimited.text, /AUTH_RATE_LIMITED/);
});

test('password mode rate limits unauthenticated image asset access', async (t) => {
    const { baseUrl } = await startServer(t, createPasswordAuthConfig());

    for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await fetch(`${baseUrl}/assets/images/2026/4/15/private.png`, {
            headers: { Accept: 'image/png,image/*' },
            redirect: 'manual',
        });

        assert.equal(response.status, 401);
    }

    const rateLimited = await fetch(`${baseUrl}/assets/images/2026/4/15/private.png`, {
        headers: { Accept: 'image/png,image/*' },
        redirect: 'manual',
    });
    const body = (await rateLimited.json()) as Record<string, unknown>;

    assert.equal(rateLimited.status, 429);
    assert.equal(rateLimited.headers.get('cache-control'), 'no-store');
    assert.equal(body.code, 'IMAGE_ASSET_RATE_LIMITED');
});

test('password login page redirects stale CSRF submissions to a fresh login page', async (t) => {
    const authConfig = createPasswordAuthConfig();
    const firstServer = await startServer(t, authConfig);
    const loginPage = await fetch(`${firstServer.baseUrl}/login?next=%2Fnotes`);
    const csrfToken = extractCsrfTokenFromHtml(await loginPage.text());
    const loginCookie = toCookieHeader(getSetCookies(loginPage.headers));

    assert.ok(csrfToken);
    assert.ok(loginCookie);

    await firstServer.close();

    const secondServer = await startServer(t, authConfig);
    const response = await formRequest(
        secondServer.baseUrl,
        '/login',
        {
            next: '/notes',
            password: 'secret',
            _csrf: csrfToken,
        },
        loginCookie,
    );

    assert.equal(response.status, 303);
    assert.equal(response.location, '/login?next=%2Fnotes');
});
