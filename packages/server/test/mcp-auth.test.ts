import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test, { type TestContext } from 'node:test';
import { createAppWithMcpAuth } from '../src/app.js';
import type { McpAdminService } from '../src/features/mcp-admin/service.js';
import { AUTH_SESSION_COOKIE_NAME, type AuthConfig } from '../src/modules/auth-mode.js';

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

const startServer = async (t: TestContext, authConfig: AuthConfig, mcpAdminAuth: McpAdminService) => {
    const app = createAppWithMcpAuth(authConfig, mcpAdminAuth);
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

const graphRequest = async (baseUrl: string, path: string, query: string, bearerToken?: string) => {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        },
        body: JSON.stringify({ query }),
    });

    return {
        status: response.status,
        body: (await response.json()) as Record<string, unknown>,
    };
};

const deleteNoteRequest = async (baseUrl: string, noteId: string, bearerToken?: string) => {
    const response = await fetch(`${baseUrl}/api/mcp/notes/delete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        },
        body: JSON.stringify({ id: noteId }),
    });

    return {
        status: response.status,
        body: (await response.json()) as Record<string, unknown>,
    };
};

const createTagRequest = async (baseUrl: string, name: string, bearerToken?: string) => {
    const response = await fetch(`${baseUrl}/api/mcp/tags/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        },
        body: JSON.stringify({ name }),
    });

    return {
        status: response.status,
        body: (await response.json()) as Record<string, unknown>,
    };
};

const createNoteRequest = async (baseUrl: string, body: Record<string, unknown>, bearerToken?: string) => {
    const response = await fetch(`${baseUrl}/api/mcp/notes/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        },
        body: JSON.stringify(body),
    });

    return {
        status: response.status,
        body: (await response.json()) as Record<string, unknown>,
    };
};

const connectServerEvents = async (baseUrl: string) => {
    return fetch(`${baseUrl}/api/events`, {
        headers: {
            Accept: 'text/event-stream',
        },
    });
};

const updateNoteRequest = async (baseUrl: string, body: Record<string, unknown>, bearerToken?: string) => {
    const response = await fetch(`${baseUrl}/api/mcp/notes/update`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        },
        body: JSON.stringify(body),
    });

    return {
        status: response.status,
        body: (await response.json()) as Record<string, unknown>,
    };
};

const createMcpAdminAuth = (options: {
    enabled: boolean;
    expectedToken?: string;
    configured?: boolean;
}): McpAdminService => {
    const expectedToken = options.expectedToken ?? 'mcp-secret';
    const configured = options.configured ?? true;

    return {
        setEnabled: async () => undefined,
        rotateToken: async () => ({ token: 'issued-mcp-token' }),
        revokeActiveToken: async () => undefined,
        getStatus: async () => ({
            enabled: options.enabled,
            hasActiveToken: configured,
            token: configured
                ? {
                      id: '1',
                      createdAt: '2026-04-04T00:00:00.000Z',
                      lastUsedAt: null,
                  }
                : null,
        }),
        validatePresentedToken: async (token) => {
            if (!configured) {
                return {
                    ok: false,
                    reason: 'not_configured',
                };
            }

            if (token === expectedToken) {
                return { ok: true };
            }

            return {
                ok: false,
                reason: 'forbidden',
            };
        },
    };
};

test('password mode requires a valid bearer token on the MCP graphql endpoint', async (t) => {
    const { baseUrl } = await startServer(
        t,
        createPasswordAuthConfig(),
        createMcpAdminAuth({ enabled: true, expectedToken: 'mcp-secret' }),
    );

    const unauthorized = await graphRequest(baseUrl, '/graphql/mcp', 'query { __typename }');
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.body.code, 'UNAUTHORIZED');

    const forbidden = await graphRequest(baseUrl, '/graphql/mcp', 'query { __typename }', 'wrong-token');
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, 'FORBIDDEN');

    const authorized = await graphRequest(baseUrl, '/graphql/mcp', 'query { __typename }', 'mcp-secret');
    assert.equal(authorized.status, 200);
    assert.equal((authorized.body.data as { __typename?: string }).__typename, 'Query');
});

test('password mode requires a session on the server events endpoint', async (t) => {
    const { baseUrl } = await startServer(
        t,
        createPasswordAuthConfig(),
        createMcpAdminAuth({ enabled: true, expectedToken: 'mcp-secret' }),
    );

    const response = await connectServerEvents(baseUrl);

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
    });
});

test('open mode exposes the server events endpoint as an event stream', async (t) => {
    const { baseUrl } = await startServer(
        t,
        createOpenAuthConfig(),
        createMcpAdminAuth({ enabled: true, expectedToken: 'mcp-secret' }),
    );

    const response = await connectServerEvents(baseUrl);

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /^text\/event-stream/);
    await response.body?.cancel();
});

test('password mode keeps the MCP graphql endpoint read-only even with a valid bearer token', async (t) => {
    const { baseUrl } = await startServer(
        t,
        createPasswordAuthConfig(),
        createMcpAdminAuth({ enabled: true, expectedToken: 'mcp-secret' }),
    );

    const mutation = await graphRequest(baseUrl, '/graphql/mcp', 'mutation { __typename }', 'mcp-secret');
    assert.equal(mutation.status, 200);
    assert.equal((mutation.body.errors as Array<{ extensions?: { code?: string } }>)[0]?.extensions?.code, 'FORBIDDEN');
});

test('mcp disabled state blocks MCP graphql access even with a valid token', async (t) => {
    const { baseUrl } = await startServer(
        t,
        createOpenAuthConfig(),
        createMcpAdminAuth({ enabled: false, expectedToken: 'mcp-secret' }),
    );

    const query = await graphRequest(baseUrl, '/graphql/mcp', 'query { __typename }', 'mcp-secret');
    assert.equal(query.status, 403);
    assert.equal(query.body.code, 'MCP_DISABLED');
});

test('enabled state still requires a valid bearer token on the MCP note delete endpoint', async (t) => {
    const { baseUrl } = await startServer(
        t,
        createOpenAuthConfig(),
        createMcpAdminAuth({ enabled: true, expectedToken: 'mcp-secret' }),
    );

    const unauthorized = await deleteNoteRequest(baseUrl, '1');
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.body.code, 'UNAUTHORIZED');

    const forbidden = await deleteNoteRequest(baseUrl, '1', 'wrong-token');
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, 'FORBIDDEN');

    const authorized = await deleteNoteRequest(baseUrl, 'abc', 'mcp-secret');
    assert.equal(authorized.status, 400);
    assert.equal(authorized.body.code, 'INVALID_NOTE_ID');
});

test('enabled state still requires a valid bearer token on the MCP note create endpoint', async (t) => {
    const { baseUrl } = await startServer(
        t,
        createOpenAuthConfig(),
        createMcpAdminAuth({ enabled: true, expectedToken: 'mcp-secret' }),
    );

    const unauthorized = await createNoteRequest(baseUrl, {});
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.body.code, 'UNAUTHORIZED');

    const forbidden = await createNoteRequest(baseUrl, {}, 'wrong-token');
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, 'FORBIDDEN');

    const authorized = await createNoteRequest(baseUrl, {}, 'mcp-secret');
    assert.equal(authorized.status, 400);
    assert.equal(authorized.body.code, 'INVALID_NOTE_TITLE');
});

test('enabled state still requires a valid bearer token on the MCP note update endpoint', async (t) => {
    const { baseUrl } = await startServer(
        t,
        createOpenAuthConfig(),
        createMcpAdminAuth({ enabled: true, expectedToken: 'mcp-secret' }),
    );

    const unauthorized = await updateNoteRequest(baseUrl, { id: 'abc' });
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.body.code, 'UNAUTHORIZED');

    const forbidden = await updateNoteRequest(baseUrl, { id: 'abc' }, 'wrong-token');
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, 'FORBIDDEN');

    const authorized = await updateNoteRequest(baseUrl, { id: 'abc' }, 'mcp-secret');
    assert.equal(authorized.status, 400);
    assert.equal(authorized.body.code, 'INVALID_NOTE_ID');
});

test('enabled state still requires a valid bearer token on the MCP tag create endpoint', async (t) => {
    const { baseUrl } = await startServer(
        t,
        createOpenAuthConfig(),
        createMcpAdminAuth({ enabled: true, expectedToken: 'mcp-secret' }),
    );

    const unauthorized = await createTagRequest(baseUrl, '');
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.body.code, 'UNAUTHORIZED');

    const forbidden = await createTagRequest(baseUrl, '', 'wrong-token');
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, 'FORBIDDEN');

    const authorized = await createTagRequest(baseUrl, '', 'mcp-secret');
    assert.equal(authorized.status, 400);
    assert.equal(authorized.body.code, 'INVALID_TAG_NAME');
});

test('password mode returns configuration error on the MCP note delete endpoint when no bearer token is configured', async (t) => {
    const { baseUrl } = await startServer(
        t,
        createPasswordAuthConfig(),
        createMcpAdminAuth({ enabled: true, configured: false }),
    );

    const response = await deleteNoteRequest(baseUrl, '1', 'mcp-secret');
    assert.equal(response.status, 503);
    assert.equal(response.body.code, 'MCP_AUTH_NOT_CONFIGURED');
});

test('password mode returns configuration error on the MCP note create endpoint when no bearer token is configured', async (t) => {
    const { baseUrl } = await startServer(
        t,
        createPasswordAuthConfig(),
        createMcpAdminAuth({ enabled: true, configured: false }),
    );

    const response = await createNoteRequest(baseUrl, { title: 'Draft' }, 'mcp-secret');
    assert.equal(response.status, 503);
    assert.equal(response.body.code, 'MCP_AUTH_NOT_CONFIGURED');
});

test('password mode returns configuration error on the MCP note update endpoint when no bearer token is configured', async (t) => {
    const { baseUrl } = await startServer(
        t,
        createPasswordAuthConfig(),
        createMcpAdminAuth({ enabled: true, configured: false }),
    );

    const response = await updateNoteRequest(baseUrl, { id: '1', title: 'Draft' }, 'mcp-secret');
    assert.equal(response.status, 503);
    assert.equal(response.body.code, 'MCP_AUTH_NOT_CONFIGURED');
});

test('password mode returns configuration error on the MCP tag create endpoint when no bearer token is configured', async (t) => {
    const { baseUrl } = await startServer(
        t,
        createPasswordAuthConfig(),
        createMcpAdminAuth({ enabled: true, configured: false }),
    );

    const response = await createTagRequest(baseUrl, 'project', 'mcp-secret');
    assert.equal(response.status, 503);
    assert.equal(response.body.code, 'MCP_AUTH_NOT_CONFIGURED');
});
