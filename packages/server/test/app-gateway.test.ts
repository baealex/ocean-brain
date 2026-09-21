import assert from 'node:assert/strict';
import { createServer, request as httpRequest, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import test, { type TestContext } from 'node:test';
import { WebSocket, WebSocketServer } from 'ws';
import { createApp } from '../src/app.js';
import {
    APP_GATEWAY_ACCESS_COOKIE_NAME,
    APP_GATEWAY_ACCESS_HEADER,
    APP_GATEWAY_ACCESS_PROTOCOL_PREFIX,
    APP_GATEWAY_PROTOCOL,
} from '../src/features/app-gateway/access.js';
import type { AppGatewayConnection, AppGatewayOptions } from '../src/features/app-gateway/gateway.js';
import { AUTH_SESSION_COOKIE_NAME, type AuthConfig } from '../src/modules/auth-mode.js';

const CONNECTION: AppGatewayConnection = {
    id: 'search-1',
    integrationId: 'ocean-brain.elasticsearch',
    enabled: true,
    proxyUrl: null,
};
const openAuth = { mode: 'open', cookieName: AUTH_SESSION_COOKIE_NAME, source: 'explicit-open' } as const;
const passwordAuth: AuthConfig = {
    mode: 'password',
    password: 'secret',
    sessionSecret: 'app-gateway-test-secret-1234567890123456',
    cookieName: AUTH_SESSION_COOKIE_NAME,
    source: 'password',
};

const listen = (server: Server) =>
    new Promise<string>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.off('error', reject);
            const address = server.address() as AddressInfo;
            resolve(`http://127.0.0.1:${address.port}`);
        });
    });

const closeServer = (server: Server) =>
    new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) reject(error);
            else resolve();
        });
    });

const readBody = (request: IncomingMessage) =>
    new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];
        request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        request.on('error', reject);
    });

const createGatewayOptions = (
    proxyUrl: string,
    resolveConnection: AppGatewayOptions['resolveConnection'] = async (id) =>
        id === CONNECTION.id ? { ...CONNECTION, proxyUrl } : null,
): AppGatewayOptions => ({
    resolveConnection,
});

const startOceanBrain = async (t: TestContext, authConfig: AuthConfig, appGateway?: AppGatewayOptions) => {
    const app = createApp(authConfig, { logger: false, appGateway });
    const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
    t.after(() => app.close());
    return baseUrl;
};

const waitForWebSocketOpen = (socket: WebSocket) =>
    new Promise<void>((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
    });

const waitForWebSocketMessage = (socket: WebSocket) =>
    new Promise<string>((resolve, reject) => {
        socket.once('message', (data) => resolve(data.toString()));
        socket.once('error', reject);
    });

const waitForWebSocketClose = (socket: WebSocket) =>
    new Promise<void>((resolve) => {
        if (socket.readyState === WebSocket.CLOSED) resolve();
        else socket.once('close', () => resolve());
    });

const getSetCookies = (headers: Headers) => {
    const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    if (typeof getSetCookie === 'function') return getSetCookie.call(headers);

    const setCookie = headers.get('set-cookie');
    return setCookie ? setCookie.split(/,(?=\s*[^;,]+=)/).map((cookie) => cookie.trim()) : [];
};

const cookieHeader = (cookies: string[]) => {
    const values = new Map<string, string>();
    for (const cookie of cookies) {
        const value = cookie.split(';')[0];
        values.set(value.slice(0, value.indexOf('=')), value);
    }
    return Array.from(values.values()).join('; ');
};

const login = async (baseUrl: string) => {
    const session = await fetch(`${baseUrl}/api/auth/session`);
    const csrfCookies = getSetCookies(session.headers);
    const csrfCookie = csrfCookies.find((cookie) => cookie.startsWith('XSRF-TOKEN='));
    const csrfToken = csrfCookie?.split(';')[0].slice('XSRF-TOKEN='.length);
    assert.ok(csrfToken);

    const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
            Cookie: cookieHeader(csrfCookies),
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': decodeURIComponent(csrfToken),
        },
        body: JSON.stringify({ password: 'secret' }),
    });
    assert.equal(response.status, 200);

    return cookieHeader([...csrfCookies, ...getSetCookies(response.headers)]);
};

const issueGatewayAccess = async (baseUrl: string, cookies?: string, origin?: string) => {
    const csrfCookie = cookies
        ?.split('; ')
        .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
        ?.slice('XSRF-TOKEN='.length);
    const response = await fetch(`${baseUrl}/api/app-gateway/connections/search-1/access`, {
        method: 'POST',
        headers: {
            ...(cookies ? { Cookie: cookies } : {}),
            ...(origin ? { Origin: origin } : {}),
            ...(csrfCookie ? { 'X-XSRF-TOKEN': decodeURIComponent(csrfCookie) } : {}),
        },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const payload = (await response.json()) as { connectionId: string; token: string; expiresAt: string };
    assert.equal(payload.connectionId, CONNECTION.id);
    assert.ok(Date.parse(payload.expiresAt) > Date.now());
    const accessCookie = getSetCookies(response.headers).find((cookie) =>
        cookie.startsWith(`${APP_GATEWAY_ACCESS_COOKIE_NAME}=`),
    );
    assert.ok(accessCookie);
    assert.match(accessCookie, /HttpOnly/i);
    assert.match(accessCookie, /SameSite=None/i);
    assert.match(accessCookie, /Secure/i);
    assert.match(accessCookie, /Path=\/apps\/search-1/i);
    return { token: payload.token, cookie: accessCookie.split(';')[0] };
};

const requestRawPath = (baseUrl: string, path: string) =>
    new Promise<number>((resolve, reject) => {
        const url = new URL(baseUrl);
        const request = httpRequest(
            {
                host: url.hostname,
                port: url.port,
                path,
            },
            (response) => {
                response.resume();
                response.once('end', () => resolve(response.statusCode ?? 0));
            },
        );
        request.once('error', reject);
        request.end();
    });

test('proxied app HTTP requests use the direct target path without leaking browser credentials', async (t) => {
    let received: { url?: string; method?: string; headers?: IncomingMessage['headers']; body?: string } = {};
    const target = createServer(async (request, response) => {
        received = {
            url: request.url,
            method: request.method,
            headers: request.headers,
            body: await readBody(request),
        };
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Set-Cookie', 'target-session=must-not-reach-browser; Path=/');
        response.end(JSON.stringify({ proxied: true }));
    });
    const targetOrigin = await listen(target);
    t.after(() => closeServer(target));
    const baseUrl = await startOceanBrain(t, openAuth, createGatewayOptions(targetOrigin));
    const publicUrl = new URL(baseUrl);
    publicUrl.protocol = 'https:';
    const access = await issueGatewayAccess(baseUrl, undefined, publicUrl.origin);

    const response = await fetch(`${baseUrl}/apps/search-1/api/items?limit=2`, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer browser-secret',
            Cookie: `${access.cookie}; owner-session=browser-secret`,
            Origin: 'null',
            'Content-Type': 'text/plain',
            [APP_GATEWAY_ACCESS_HEADER]: access.token,
            'X-Ocean-Brain-Integration-Id': 'spoofed-integration',
            'X-Forwarded-Client-Cert': 'spoofed-certificate',
            'X-XSRF-TOKEN': 'browser-csrf-secret',
        },
        body: 'hello target',
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { proxied: true });
    assert.equal(received.url, '/api/items?limit=2');
    assert.equal(received.method, 'POST');
    assert.equal(received.body, 'hello target');
    assert.equal(received.headers?.authorization, undefined);
    assert.equal(received.headers?.cookie, undefined);
    assert.equal(received.headers?.['x-forwarded-client-cert'], undefined);
    assert.equal(received.headers?.[APP_GATEWAY_ACCESS_HEADER], undefined);
    assert.equal(received.headers?.['x-xsrf-token'], undefined);
    assert.equal(received.headers?.['x-ocean-brain-integration-id'], CONNECTION.integrationId);
    assert.equal(received.headers?.['x-ocean-brain-connection-id'], CONNECTION.id);
    assert.equal(received.headers?.['x-forwarded-prefix'], '/apps/search-1');
    assert.equal(received.headers?.['x-forwarded-proto'], 'https');
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('access-control-allow-origin'), 'null');
    assert.match(response.headers.get('content-security-policy') ?? '', /sandbox/);
    assert.match(response.headers.get('content-security-policy') ?? '', /allow-same-site-none-cookies/);
    assert.doesNotMatch(response.headers.get('content-security-policy') ?? '', /allow-same-origin/);
    assert.equal(
        response.headers.get('permissions-policy'),
        'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
    );
});

test('proxied app HTTP requests preserve form-encoded request bodies', async (t) => {
    let receivedBody = '';
    const target = createServer(async (request, response) => {
        receivedBody = await readBody(request);
        response.statusCode = 204;
        response.end();
    });
    const targetOrigin = await listen(target);
    t.after(() => closeServer(target));
    const baseUrl = await startOceanBrain(t, openAuth, createGatewayOptions(targetOrigin));
    const access = await issueGatewayAccess(baseUrl);
    const body = 'title=Ocean+Brain&tags=proxy%2Cinbox';

    const response = await fetch(`${baseUrl}/apps/search-1/notes`, {
        method: 'POST',
        headers: {
            Cookie: access.cookie,
            Origin: 'null',
            'Content-Type': 'application/x-www-form-urlencoded',
            [APP_GATEWAY_ACCESS_HEADER]: access.token,
        },
        body,
    });

    assert.equal(response.status, 204);
    assert.equal(receivedBody, body);
});

test('proxied app access rejects a foreign browser origin', async (t) => {
    const baseUrl = await startOceanBrain(t, openAuth, createGatewayOptions('http://127.0.0.1:1'));

    const response = await fetch(`${baseUrl}/api/app-gateway/connections/search-1/access`, {
        method: 'POST',
        headers: { Origin: 'https://untrusted.example' },
    });

    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'FORBIDDEN_ORIGIN');
});

test('sandboxed app API responses require the in-memory access token for CORS', async (t) => {
    const target = createServer((_request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ private: true }));
    });
    const targetOrigin = await listen(target);
    t.after(() => closeServer(target));
    const baseUrl = await startOceanBrain(t, openAuth, createGatewayOptions(targetOrigin));
    const access = await issueGatewayAccess(baseUrl);

    const response = await fetch(`${baseUrl}/apps/search-1/api/private`, {
        headers: { Cookie: access.cookie, Origin: 'null' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('sandboxed app writes require the in-memory access token before reaching the target', async (t) => {
    let targetRequests = 0;
    const target = createServer((_request, response) => {
        targetRequests += 1;
        response.end('unexpected');
    });
    const targetOrigin = await listen(target);
    t.after(() => closeServer(target));
    const baseUrl = await startOceanBrain(t, openAuth, createGatewayOptions(targetOrigin));
    const access = await issueGatewayAccess(baseUrl);

    const response = await fetch(`${baseUrl}/apps/search-1/api/private`, {
        method: 'POST',
        headers: { Cookie: access.cookie, Origin: 'null' },
    });

    assert.equal(response.status, 403);
    assert.equal(targetRequests, 0);
});

test('sandboxed app assets receive CORS without exposing the access token', async (t) => {
    let accessHeader: string | undefined;
    const target = createServer((request, response) => {
        accessHeader = request.headers[APP_GATEWAY_ACCESS_HEADER] as string | undefined;
        response.setHeader('Content-Type', 'text/javascript');
        response.end('export default true;');
    });
    const targetOrigin = await listen(target);
    t.after(() => closeServer(target));
    const baseUrl = await startOceanBrain(t, openAuth, createGatewayOptions(targetOrigin));
    const access = await issueGatewayAccess(baseUrl);

    const response = await fetch(`${baseUrl}/apps/search-1/assets/app.js`, {
        headers: {
            Cookie: access.cookie,
            Origin: 'null',
            'Sec-Fetch-Dest': 'script',
        },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'null');
    assert.equal(accessHeader, undefined);
});

test('proxied app gateway rewrites target redirects to the public app subpath', async (t) => {
    let targetOrigin = '';
    const target = createServer((_request, response) => {
        response.statusCode = 302;
        response.setHeader('Location', `${targetOrigin}/results?q=ocean`);
        response.end();
    });
    targetOrigin = await listen(target);
    t.after(() => closeServer(target));
    const baseUrl = await startOceanBrain(t, openAuth, createGatewayOptions(targetOrigin));
    const access = await issueGatewayAccess(baseUrl);

    const response = await fetch(`${baseUrl}/apps/search-1/search`, {
        headers: { Cookie: access.cookie },
        redirect: 'manual',
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/apps/search-1/results?q=ocean');
});

test('proxied app gateway canonicalizes a connection root before relative app requests resolve', async (t) => {
    let targetRequests = 0;
    const target = createServer((_request, response) => {
        targetRequests += 1;
        response.end('unexpected');
    });
    const targetOrigin = await listen(target);
    t.after(() => closeServer(target));
    const baseUrl = await startOceanBrain(t, openAuth, createGatewayOptions(targetOrigin));
    const access = await issueGatewayAccess(baseUrl);

    const response = await fetch(`${baseUrl}/apps/search-1?source=navigation`, {
        headers: { Cookie: access.cookie },
        redirect: 'manual',
    });

    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), '/apps/search-1/?source=navigation');
    assert.equal(targetRequests, 0);
});

test('proxied app gateway blocks anonymous access before contacting the target', async (t) => {
    let targetRequests = 0;
    const target = createServer((_request, response) => {
        targetRequests += 1;
        response.end('unexpected');
    });
    const targetOrigin = await listen(target);
    t.after(() => closeServer(target));
    const baseUrl = await startOceanBrain(t, passwordAuth, createGatewayOptions(targetOrigin));

    const response = await fetch(`${baseUrl}/apps/search-1/`);

    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'UNAUTHORIZED');
    assert.equal(targetRequests, 0);
});

test('proxied app gateway blocks disabled connections before contacting the target', async (t) => {
    let targetRequests = 0;
    const target = createServer((_request, response) => {
        targetRequests += 1;
        response.end('unexpected');
    });
    const targetOrigin = await listen(target);
    t.after(() => closeServer(target));
    let connection: AppGatewayConnection = { ...CONNECTION, proxyUrl: targetOrigin };
    const baseUrl = await startOceanBrain(
        t,
        openAuth,
        createGatewayOptions(targetOrigin, async () => connection),
    );
    const access = await issueGatewayAccess(baseUrl);
    connection = { ...connection, enabled: false };

    const response = await fetch(`${baseUrl}/apps/search-1/`, { headers: { Cookie: access.cookie } });

    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'APP_CONNECTION_DISABLED');
    assert.equal(targetRequests, 0);
});

test('proxied app gateway blocks requests when the private URL is removed after an access grant', async (t) => {
    let connection: AppGatewayConnection = { ...CONNECTION, proxyUrl: 'http://127.0.0.1:1' };
    const baseUrl = await startOceanBrain(
        t,
        openAuth,
        createGatewayOptions(connection.proxyUrl, async () => connection),
    );
    const access = await issueGatewayAccess(baseUrl);
    connection = { ...connection, proxyUrl: null };

    const response = await fetch(`${baseUrl}/apps/search-1/`, { headers: { Cookie: access.cookie } });

    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'APP_PROXY_NOT_CONFIGURED');
});

test('proxied app gateway rejects path traversal before it reaches the target', async (t) => {
    let targetRequests = 0;
    const target = createServer((_request, response) => {
        targetRequests += 1;
        response.end('unexpected');
    });
    const targetOrigin = await listen(target);
    t.after(() => closeServer(target));
    const baseUrl = await startOceanBrain(t, openAuth, createGatewayOptions(targetOrigin));

    const status = await requestRawPath(baseUrl, '/apps/search-1/dir\\..\\..\\admin');

    assert.equal(status, 400);
    assert.equal(targetRequests, 0);
});

test('proxied app WebSockets use the same target path and credential boundary', async (t) => {
    let upgradeUrl: string | undefined;
    let upgradeHeaders: IncomingMessage['headers'] | undefined;
    const target = createServer();
    const targetSockets = new WebSocketServer({ noServer: true });
    target.on('upgrade', (request, socket, head) => {
        upgradeUrl = request.url;
        upgradeHeaders = request.headers;
        targetSockets.handleUpgrade(request, socket, head, (webSocket) => {
            targetSockets.emit('connection', webSocket, request);
        });
    });
    targetSockets.on('connection', (socket) => {
        socket.on('message', (data) => socket.send(`echo:${data.toString()}`));
    });
    const targetOrigin = await listen(target);
    t.after(async () => {
        targetSockets.close();
        await closeServer(target);
    });
    const baseUrl = await startOceanBrain(t, passwordAuth, createGatewayOptions(targetOrigin));
    const sessionCookie = await login(baseUrl);
    const access = await issueGatewayAccess(baseUrl, sessionCookie);
    const socket = new WebSocket(
        `${baseUrl.replace('http:', 'ws:')}/apps/search-1/live`,
        [APP_GATEWAY_PROTOCOL, `${APP_GATEWAY_ACCESS_PROTOCOL_PREFIX}${access.token}`],
        {
            headers: {
                Authorization: 'Bearer browser-secret',
                Cookie: `${sessionCookie}; ${access.cookie}; unrelated=browser-secret`,
                'X-Ocean-Brain-Integration-Id': 'spoofed-integration',
            },
        },
    );

    await waitForWebSocketOpen(socket);
    socket.send('ping');
    const message = await waitForWebSocketMessage(socket);
    socket.close();
    await waitForWebSocketClose(socket);

    assert.equal(message, 'echo:ping');
    assert.equal(upgradeUrl, '/live');
    assert.equal(upgradeHeaders?.authorization, undefined);
    assert.equal(upgradeHeaders?.cookie, undefined);
    assert.equal(upgradeHeaders?.['sec-websocket-protocol'], APP_GATEWAY_PROTOCOL);
    assert.doesNotMatch(upgradeHeaders?.['sec-websocket-protocol'] ?? '', new RegExp(access.token));
    assert.equal(upgradeHeaders?.['x-ocean-brain-integration-id'], CONNECTION.integrationId);
    assert.equal(upgradeHeaders?.['x-ocean-brain-connection-id'], CONNECTION.id);
});
