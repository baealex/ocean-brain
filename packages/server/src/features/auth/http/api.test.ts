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

const createOpenAuthConfig = (): AuthConfig => ({
    mode: 'open',
    cookieName: AUTH_SESSION_COOKIE_NAME,
    source: 'explicit-open',
});

const startServer = async (t: TestContext, authConfig: AuthConfig) => {
    const app = createApp(authConfig);
    const server = app.listen(0);

    await new Promise<void>((resolve, reject) => {
        server.once('listening', () => resolve());
        server.once('error', reject);
    });

    t.after(() => {
        server.close();
    });

    const address = server.address() as AddressInfo;

    return { baseUrl: `http://127.0.0.1:${address.port}` };
};

const getSetCookies = (headers: Headers) => {
    const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    if (typeof getSetCookie === 'function') {
        return getSetCookie.call(headers);
    }

    const setCookie = headers.get('set-cookie');
    return setCookie ? [setCookie] : [];
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

const extractCsrfToken = (cookie?: string) => {
    const token = cookie
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('XSRF-TOKEN='))
        ?.slice('XSRF-TOKEN='.length);

    return token ? decodeURIComponent(token) : undefined;
};

const fetchCsrfCookie = async (baseUrl: string, cookie?: string) => {
    const response = await fetch(`${baseUrl}/api/auth/session`, {
        headers: cookie ? { Cookie: cookie } : undefined,
    });
    const setCookieHeader = toCookieHeader(getSetCookies(response.headers));

    return mergeCookieHeaders(cookie, setCookieHeader);
};

const graphRequest = async (baseUrl: string, query: string, cookie?: string) => {
    const requestCookie = await fetchCsrfCookie(baseUrl, cookie);
    const csrfToken = extractCsrfToken(requestCookie);
    const response = await fetch(`${baseUrl}/graphql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(requestCookie ? { Cookie: requestCookie } : {}),
            ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {}),
        },
        body: JSON.stringify({ query }),
    });

    return {
        status: response.status,
        body: (await response.json()) as Record<string, unknown>,
    };
};

const jsonRequest = async (
    baseUrl: string,
    path: string,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
    cookie?: string,
) => {
    const requestCookie = method === 'POST' ? await fetchCsrfCookie(baseUrl, cookie) : cookie;
    const csrfToken = extractCsrfToken(requestCookie);
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
            ...(requestCookie ? { Cookie: requestCookie } : {}),
            ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    return {
        status: response.status,
        body: (await response.json()) as Record<string, unknown>,
        cookie: mergeCookieHeaders(requestCookie, toCookieHeader(getSetCookies(response.headers))) || undefined,
    };
};

test('password mode protects write paths until login and unlocks them after session auth', async (t) => {
    const { baseUrl } = await startServer(t, createPasswordAuthConfig());

    const anonymousSession = await jsonRequest(baseUrl, '/api/auth/session', 'GET');
    assert.equal(anonymousSession.status, 200);
    assert.deepEqual(anonymousSession.body, {
        mode: 'password',
        authRequired: true,
        authenticated: false,
    });

    const unauthorizedImageWrite = await jsonRequest(baseUrl, '/api/image', 'POST', {});
    assert.equal(unauthorizedImageWrite.status, 401);
    assert.equal(unauthorizedImageWrite.body.code, 'UNAUTHORIZED');

    const unauthorizedMutation = await graphRequest(baseUrl, 'mutation { __typename }');
    assert.equal(unauthorizedMutation.status, 401);
    assert.equal(
        (unauthorizedMutation.body.errors as Array<{ extensions?: { code?: string } }>)[0]?.extensions?.code,
        'UNAUTHORIZED',
    );

    const publicQuery = await graphRequest(baseUrl, 'query { __typename }');
    assert.equal(publicQuery.status, 401);
    assert.equal(
        (publicQuery.body.errors as Array<{ extensions?: { code?: string } }>)[0]?.extensions?.code,
        'UNAUTHORIZED',
    );

    const wrongPassword = await jsonRequest(baseUrl, '/api/auth/login', 'POST', { password: 'wrong' });
    assert.equal(wrongPassword.status, 401);
    assert.equal(wrongPassword.body.code, 'UNAUTHORIZED');

    const login = await jsonRequest(baseUrl, '/api/auth/login', 'POST', { password: 'secret' });
    assert.equal(login.status, 200);
    assert.ok(login.cookie);
    assert.deepEqual(login.body, {
        mode: 'password',
        authRequired: true,
        authenticated: true,
    });

    const authenticatedSession = await jsonRequest(baseUrl, '/api/auth/session', 'GET', undefined, login.cookie);
    assert.equal(authenticatedSession.status, 200);
    assert.deepEqual(authenticatedSession.body, {
        mode: 'password',
        authRequired: true,
        authenticated: true,
    });

    const authenticatedImageWrite = await jsonRequest(baseUrl, '/api/image', 'POST', {}, login.cookie);
    assert.equal(authenticatedImageWrite.status, 400);
    assert.equal(authenticatedImageWrite.body.code, 'INVALID_IMAGE_UPLOAD');
    assert.equal(authenticatedImageWrite.body.message, 'No image uploaded');

    const authenticatedMutation = await graphRequest(baseUrl, 'mutation { __typename }', login.cookie);
    assert.equal(authenticatedMutation.status, 200);
    assert.equal((authenticatedMutation.body.data as { __typename?: string }).__typename, 'Mutation');

    const authenticatedQuery = await graphRequest(baseUrl, 'query { __typename }', login.cookie);
    assert.equal(authenticatedQuery.status, 200);
    assert.equal((authenticatedQuery.body.data as { __typename?: string }).__typename, 'Query');

    const logout = await jsonRequest(baseUrl, '/api/auth/logout', 'POST', {}, login.cookie);
    assert.equal(logout.status, 200);
    assert.deepEqual(logout.body, {
        mode: 'password',
        authRequired: true,
        authenticated: false,
    });

    const postLogoutWrite = await jsonRequest(baseUrl, '/api/image', 'POST', {}, login.cookie);
    assert.equal(postLogoutWrite.status, 401);
    assert.equal(postLogoutWrite.body.code, 'UNAUTHORIZED');
});

test('password login API rate limits repeated failed attempts', async (t) => {
    const { baseUrl } = await startServer(t, createPasswordAuthConfig());

    for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await jsonRequest(baseUrl, '/api/auth/login', 'POST', { password: 'wrong' });
        assert.equal(response.status, 401);
        assert.equal(response.body.code, 'UNAUTHORIZED');
    }

    const rateLimited = await jsonRequest(baseUrl, '/api/auth/login', 'POST', { password: 'wrong' });

    assert.equal(rateLimited.status, 429);
    assert.equal(rateLimited.body.code, 'AUTH_RATE_LIMITED');
});

test('password mode rejects unsafe API requests without a CSRF token', async (t) => {
    const { baseUrl } = await startServer(t, createPasswordAuthConfig());
    const login = await jsonRequest(baseUrl, '/api/auth/login', 'POST', { password: 'secret' });
    assert.equal(login.status, 200);
    assert.ok(login.cookie);

    const response = await fetch(`${baseUrl}/api/image`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: login.cookie,
        },
        body: JSON.stringify({}),
    });
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 403);
    assert.equal(body.code, 'CSRF_TOKEN_INVALID');
});

test('open mode keeps auth endpoints explicit and allows existing open write/query behavior', async (t) => {
    const { baseUrl } = await startServer(t, createOpenAuthConfig());

    const sessionStatus = await jsonRequest(baseUrl, '/api/auth/session', 'GET');
    assert.equal(sessionStatus.status, 200);
    assert.deepEqual(sessionStatus.body, {
        mode: 'open',
        authRequired: false,
        authenticated: false,
    });

    const login = await jsonRequest(baseUrl, '/api/auth/login', 'POST', { password: 'secret' });
    assert.equal(login.status, 409);
    assert.equal(login.body.code, 'AUTH_OPEN_MODE');

    const imageWrite = await jsonRequest(baseUrl, '/api/image', 'POST', {});
    assert.equal(imageWrite.status, 400);
    assert.equal(imageWrite.body.code, 'INVALID_IMAGE_UPLOAD');
    assert.equal(imageWrite.body.message, 'No image uploaded');

    const mutation = await graphRequest(baseUrl, 'mutation { __typename }');
    assert.equal(mutation.status, 200);
    assert.equal((mutation.body.data as { __typename?: string }).__typename, 'Mutation');
});
