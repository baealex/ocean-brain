import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test, { type TestContext } from 'node:test';
import { createApp } from '~/app.js';
import type { AuthConfig } from '~/modules/auth-mode.js';

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

const graphRequest = async (baseUrl: string, query: string, cookie?: string) => {
    const response = await fetch(`${baseUrl}/graphql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(cookie ? { Cookie: cookie } : {}),
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
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
            ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    return {
        status: response.status,
        body: (await response.json()) as Record<string, unknown>,
        cookie: response.headers.get('set-cookie') ?? undefined,
    };
};

test('password mode protects write paths until login and unlocks them after session auth', async (t) => {
    const { baseUrl } = await startServer(t, {
        mode: 'password',
        password: 'secret',
        sessionSecret: 'session-secret',
        source: 'override',
    });

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

test('disabled mode keeps auth endpoints explicit and allows existing open write/query behavior', async (t) => {
    const { baseUrl } = await startServer(t, {
        mode: 'disabled',
        source: 'override',
    });

    const sessionStatus = await jsonRequest(baseUrl, '/api/auth/session', 'GET');
    assert.equal(sessionStatus.status, 200);
    assert.deepEqual(sessionStatus.body, {
        mode: 'disabled',
        authRequired: false,
        authenticated: false,
    });

    const login = await jsonRequest(baseUrl, '/api/auth/login', 'POST', { password: 'secret' });
    assert.equal(login.status, 409);
    assert.equal(login.body.code, 'AUTH_DISABLED');

    const imageWrite = await jsonRequest(baseUrl, '/api/image', 'POST', {});
    assert.equal(imageWrite.status, 400);
    assert.equal(imageWrite.body.code, 'INVALID_IMAGE_UPLOAD');
    assert.equal(imageWrite.body.message, 'No image uploaded');

    const mutation = await graphRequest(baseUrl, 'mutation { __typename }');
    assert.equal(mutation.status, 200);
    assert.equal((mutation.body.data as { __typename?: string }).__typename, 'Mutation');
});
