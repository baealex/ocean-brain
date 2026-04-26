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

    await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    t.after(() => {
        server.close();
    });

    const address = server.address() as AddressInfo;

    return { baseUrl: `http://127.0.0.1:${address.port}` };
};

const formRequest = async (baseUrl: string, path: string, body: Record<string, string>, cookie?: string) => {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        redirect: 'manual',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(cookie ? { Cookie: cookie } : {}),
        },
        body: new URLSearchParams(body).toString(),
    });

    return {
        status: response.status,
        text: await response.text(),
        location: response.headers.get('location') ?? undefined,
        cookie: response.headers.get('set-cookie') ?? undefined,
    };
};

test('password mode blocks client routes until the server-side login form succeeds', async (t) => {
    const { baseUrl } = await startServer(t, createPasswordAuthConfig());

    const blockedHome = await fetch(`${baseUrl}/`, { redirect: 'manual' });

    assert.equal(blockedHome.status, 303);
    assert.equal(blockedHome.headers.get('location'), '/login?next=%2F');

    const loginPage = await fetch(`${baseUrl}/login?next=%2Fnotes`);
    const loginPageHtml = await loginPage.text();

    assert.equal(loginPage.status, 200);
    assert.match(loginPageHtml, /Ocean Brain/);
    assert.match(loginPageHtml, /Enter the workspace password to continue/);
    assert.match(loginPageHtml, /color-scheme: light dark/);
    assert.match(loginPageHtml, /prefers-color-scheme: dark/);
    assert.match(loginPageHtml, /<form method="post" action="\/login">/);
    assert.match(loginPageHtml, /name="next" value="\/notes"/);

    const invalidLogin = await formRequest(baseUrl, '/login', {
        next: '/notes',
        password: 'wrong',
    });

    assert.equal(invalidLogin.status, 401);
    assert.match(invalidLogin.text, /Invalid password/);

    const validLogin = await formRequest(baseUrl, '/login', {
        next: '/notes',
        password: 'secret',
    });

    assert.equal(validLogin.status, 303);
    assert.equal(validLogin.location, '/notes');
    assert.ok(validLogin.cookie);

    const sessionStatus = await fetch(`${baseUrl}/api/auth/session`, { headers: { Cookie: validLogin.cookie } });

    assert.equal(sessionStatus.status, 200);
    assert.deepEqual(await sessionStatus.json(), {
        mode: 'password',
        authRequired: true,
        authenticated: true,
    });

    const logout = await formRequest(baseUrl, '/logout', {}, validLogin.cookie);
    assert.equal(logout.status, 303);
    assert.equal(logout.location, '/login');
});
