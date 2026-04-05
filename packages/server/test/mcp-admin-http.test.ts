import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

import type { AuthConfig } from '../src/modules/auth-mode.js';
import type { McpAdminService } from '../src/modules/mcp-admin.js';
import { createAppWithMcpAuth } from '../src/app.js';

const createStubMcpAdminService = (input: {
    enabled?: boolean;
    hasActiveToken?: boolean;
} = {}): McpAdminService => {
    let enabled = input.enabled ?? true;
    let activeToken = input.hasActiveToken === false
        ? null
        : {
            id: '1',
            createdAt: '2026-04-04T00:00:00.000Z',
            lastUsedAt: null as string | null
        };

    return {
        getStatus: async () => ({
            enabled,
            hasActiveToken: Boolean(activeToken),
            token: activeToken
        }),
        setEnabled: async (nextEnabled) => {
            enabled = nextEnabled;
        },
        rotateToken: async () => {
            activeToken = {
                id: activeToken ? String(Number(activeToken.id) + 1) : '1',
                createdAt: new Date().toISOString(),
                lastUsedAt: null
            };
            return { token: 'issued-mcp-token' };
        },
        revokeActiveToken: async () => {
            activeToken = null;
        },
        validatePresentedToken: async () => ({ ok: false, reason: 'forbidden' })
    };
};

const startServer = async (
    t: TestContext,
    authConfig: AuthConfig,
    mcpAdminService: McpAdminService = createStubMcpAdminService()
) => {
    const app = createAppWithMcpAuth(authConfig, mcpAdminService);
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

const jsonRequest = async (
    baseUrl: string,
    path: string,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
    cookie?: string
) => {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
            ...(cookie ? { Cookie: cookie } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });

    return {
        status: response.status,
        body: await response.json() as Record<string, unknown>,
        cookie: response.headers.get('set-cookie') ?? undefined
    };
};

const login = async (baseUrl: string) => {
    const response = await jsonRequest(baseUrl, '/api/auth/login', 'POST', { password: 'secret' });
    assert.equal(response.status, 200);
    assert.ok(response.cookie);
    return response.cookie;
};

test('GET /api/mcp-admin/status requires authenticated session in password mode', async (t) => {
    const { baseUrl } = await startServer(t, {
        mode: 'password',
        password: 'secret',
        sessionSecret: 'session-secret',
        source: 'override'
    });

    const status = await jsonRequest(baseUrl, '/api/mcp-admin/status', 'GET');
    assert.equal(status.status, 401);
    assert.equal(status.body.code, 'UNAUTHORIZED');
});

test('POST /api/mcp-admin/token/rotate returns plaintext token once for authenticated session', async (t) => {
    const { baseUrl } = await startServer(
        t,
        {
            mode: 'password',
            password: 'secret',
            sessionSecret: 'session-secret',
            source: 'override'
        },
        createStubMcpAdminService()
    );

    const cookie = await login(baseUrl);

    const rotate = await jsonRequest(baseUrl, '/api/mcp-admin/token/rotate', 'POST', {}, cookie);
    assert.equal(rotate.status, 200);
    assert.equal(typeof rotate.body.token, 'string');
    assert.ok((rotate.body.token as string).length > 0);
});

test('POST /api/mcp-admin/enabled toggles enabled state for authenticated session', async (t) => {
    const service = createStubMcpAdminService({ enabled: false });
    const { baseUrl } = await startServer(
        t,
        {
            mode: 'password',
            password: 'secret',
            sessionSecret: 'session-secret',
            source: 'override'
        },
        service
    );

    const cookie = await login(baseUrl);
    const enabled = await jsonRequest(baseUrl, '/api/mcp-admin/enabled', 'POST', { enabled: true }, cookie);

    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.enabled, true);
});

test('POST /api/mcp-admin/token/revoke revokes active token for authenticated session', async (t) => {
    const service = createStubMcpAdminService({ enabled: true, hasActiveToken: true });
    const { baseUrl } = await startServer(
        t,
        {
            mode: 'password',
            password: 'secret',
            sessionSecret: 'session-secret',
            source: 'override'
        },
        service
    );

    const cookie = await login(baseUrl);
    const revoked = await jsonRequest(baseUrl, '/api/mcp-admin/token/revoke', 'POST', {}, cookie);

    assert.equal(revoked.status, 200);
    assert.equal(revoked.body.hasActiveToken, false);
    assert.equal(revoked.body.token, null);
});
