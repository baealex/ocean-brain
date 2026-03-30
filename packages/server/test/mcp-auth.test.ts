import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

import type { AuthConfig } from '../src/modules/auth-mode.js';
import type { McpAuthConfig } from '../src/modules/mcp-auth.js';
import { createAppWithMcpAuth } from '../src/app.js';

const startServer = async (
    t: TestContext,
    authConfig: AuthConfig,
    mcpAuthConfig: McpAuthConfig
) => {
    const app = createAppWithMcpAuth(authConfig, mcpAuthConfig);
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

const graphRequest = async (
    baseUrl: string,
    path: string,
    query: string,
    bearerToken?: string
) => {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {})
        },
        body: JSON.stringify({ query })
    });

    return {
        status: response.status,
        body: await response.json() as Record<string, unknown>
    };
};

const deleteNoteRequest = async (
    baseUrl: string,
    noteId: string,
    bearerToken?: string
) => {
    const response = await fetch(`${baseUrl}/api/mcp/notes/delete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {})
        },
        body: JSON.stringify({ id: noteId })
    });

    return {
        status: response.status,
        body: await response.json() as Record<string, unknown>
    };
};

const createTagRequest = async (
    baseUrl: string,
    name: string,
    bearerToken?: string
) => {
    const response = await fetch(`${baseUrl}/api/mcp/tags/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {})
        },
        body: JSON.stringify({ name })
    });

    return {
        status: response.status,
        body: await response.json() as Record<string, unknown>
    };
};

test('password mode requires a valid bearer token on the MCP graphql endpoint', async (t) => {
    const { baseUrl } = await startServer(t, {
        mode: 'password',
        password: 'secret',
        sessionSecret: 'session-secret',
        source: 'override'
    }, { tokens: ['mcp-secret'] });

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

test('password mode keeps the MCP graphql endpoint read-only even with a valid bearer token', async (t) => {
    const { baseUrl } = await startServer(t, {
        mode: 'password',
        password: 'secret',
        sessionSecret: 'session-secret',
        source: 'override'
    }, { tokens: ['mcp-secret'] });

    const mutation = await graphRequest(baseUrl, '/graphql/mcp', 'mutation { __typename }', 'mcp-secret');
    assert.equal(mutation.status, 200);
    assert.equal(
        (mutation.body.errors as Array<{ extensions?: { code?: string } }>)[0]?.extensions?.code,
        'FORBIDDEN'
    );
});

test('disabled mode allows read-only MCP graphql access without a token', async (t) => {
    const { baseUrl } = await startServer(t, {
        mode: 'disabled',
        source: 'override'
    }, { tokens: [] });

    const query = await graphRequest(baseUrl, '/graphql/mcp', 'query { __typename }');
    assert.equal(query.status, 200);
    assert.equal((query.body.data as { __typename?: string }).__typename, 'Query');
});

test('disabled mode still requires a valid bearer token on the MCP note delete endpoint', async (t) => {
    const { baseUrl } = await startServer(t, {
        mode: 'disabled',
        source: 'override'
    }, { tokens: ['mcp-secret'] });

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

test('disabled mode still requires a valid bearer token on the MCP tag create endpoint', async (t) => {
    const { baseUrl } = await startServer(t, {
        mode: 'disabled',
        source: 'override'
    }, { tokens: ['mcp-secret'] });
    const uniqueTagName = `auth-tag-${Date.now()}`;

    const unauthorized = await createTagRequest(baseUrl, uniqueTagName);
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.body.code, 'UNAUTHORIZED');

    const forbidden = await createTagRequest(baseUrl, uniqueTagName, 'wrong-token');
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, 'FORBIDDEN');

    const authorized = await createTagRequest(baseUrl, uniqueTagName, 'mcp-secret');
    assert.equal(authorized.status, 200);
    assert.equal(authorized.body.created, true);
});

test('password mode returns configuration error on the MCP note delete endpoint when no bearer token is configured', async (t) => {
    const { baseUrl } = await startServer(t, {
        mode: 'password',
        password: 'secret',
        sessionSecret: 'session-secret',
        source: 'override'
    }, { tokens: [] });

    const response = await deleteNoteRequest(baseUrl, '1', 'mcp-secret');
    assert.equal(response.status, 503);
    assert.equal(response.body.code, 'MCP_AUTH_NOT_CONFIGURED');
});

test('password mode returns configuration error on the MCP tag create endpoint when no bearer token is configured', async (t) => {
    const { baseUrl } = await startServer(t, {
        mode: 'password',
        password: 'secret',
        sessionSecret: 'session-secret',
        source: 'override'
    }, { tokens: [] });

    const response = await createTagRequest(baseUrl, 'project', 'mcp-secret');
    assert.equal(response.status, 503);
    assert.equal(response.body.code, 'MCP_AUTH_NOT_CONFIGURED');
});
