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
import type { AppGatewayInstallation, AppGatewayOptions } from '../src/features/app-gateway/gateway.js';
import { AUTH_SESSION_COOKIE_NAME, type AuthConfig } from '../src/modules/auth-mode.js';

const RUNNER_TOKEN = 'runner-token-that-is-longer-than-thirty-two-characters';
const INSTALLATION: AppGatewayInstallation = {
    id: 'search-1',
    appId: 'ocean-brain.elasticsearch',
    enabled: true,
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
    runnerOrigin: string,
    resolveInstallation: AppGatewayOptions['resolveInstallation'] = async (id) =>
        id === INSTALLATION.id ? INSTALLATION : null,
): AppGatewayOptions => ({
    runnerOrigin,
    runnerToken: RUNNER_TOKEN,
    resolveInstallation,
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

const issueGatewayAccess = async (baseUrl: string, cookies?: string) => {
    const csrfCookie = cookies
        ?.split('; ')
        .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
        ?.slice('XSRF-TOKEN='.length);
    const response = await fetch(`${baseUrl}/api/app-gateway/installations/search-1/access`, {
        method: 'POST',
        headers: {
            ...(cookies ? { Cookie: cookies } : {}),
            ...(csrfCookie ? { 'X-XSRF-TOKEN': decodeURIComponent(csrfCookie) } : {}),
        },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const payload = (await response.json()) as { installationId: string; token: string; expiresAt: string };
    assert.equal(payload.installationId, INSTALLATION.id);
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

test('managed app HTTP requests use the fixed runner path without leaking browser credentials', async (t) => {
    let received: { url?: string; method?: string; headers?: IncomingMessage['headers']; body?: string } = {};
    const runner = createServer(async (request, response) => {
        received = {
            url: request.url,
            method: request.method,
            headers: request.headers,
            body: await readBody(request),
        };
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Set-Cookie', 'runner-session=must-not-reach-browser; Path=/');
        response.end(JSON.stringify({ proxied: true }));
    });
    const runnerOrigin = await listen(runner);
    t.after(() => closeServer(runner));
    const baseUrl = await startOceanBrain(t, openAuth, createGatewayOptions(runnerOrigin));
    const access = await issueGatewayAccess(baseUrl);

    const response = await fetch(`${baseUrl}/apps/search-1/api/items?limit=2`, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer browser-secret',
            Cookie: `${access.cookie}; owner-session=browser-secret`,
            Origin: 'null',
            'Content-Type': 'text/plain',
            [APP_GATEWAY_ACCESS_HEADER]: access.token,
            'X-Ocean-Brain-App-Id': 'spoofed-app',
            'X-Forwarded-Client-Cert': 'spoofed-certificate',
            'X-XSRF-TOKEN': 'browser-csrf-secret',
        },
        body: 'hello runner',
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { proxied: true });
    assert.equal(received.url, '/v1/apps/search-1/api/items?limit=2');
    assert.equal(received.method, 'POST');
    assert.equal(received.body, 'hello runner');
    assert.equal(received.headers?.authorization, `Bearer ${RUNNER_TOKEN}`);
    assert.equal(received.headers?.cookie, undefined);
    assert.equal(received.headers?.['x-forwarded-client-cert'], undefined);
    assert.equal(received.headers?.[APP_GATEWAY_ACCESS_HEADER], undefined);
    assert.equal(received.headers?.['x-xsrf-token'], undefined);
    assert.equal(received.headers?.['x-ocean-brain-app-id'], INSTALLATION.appId);
    assert.equal(received.headers?.['x-ocean-brain-installation-id'], INSTALLATION.id);
    assert.equal(received.headers?.['x-forwarded-prefix'], '/apps/search-1');
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('access-control-allow-origin'), 'null');
    assert.match(response.headers.get('content-security-policy') ?? '', /sandbox/);
});

test('sandboxed app API responses require the in-memory access token for CORS', async (t) => {
    const runner = createServer((_request, response) => {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({ private: true }));
    });
    const runnerOrigin = await listen(runner);
    t.after(() => closeServer(runner));
    const baseUrl = await startOceanBrain(t, openAuth, createGatewayOptions(runnerOrigin));
    const access = await issueGatewayAccess(baseUrl);

    const response = await fetch(`${baseUrl}/apps/search-1/api/private`, {
        headers: { Cookie: access.cookie, Origin: 'null' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('sandboxed app writes require the in-memory access token before reaching the runner', async (t) => {
    let runnerRequests = 0;
    const runner = createServer((_request, response) => {
        runnerRequests += 1;
        response.end('unexpected');
    });
    const runnerOrigin = await listen(runner);
    t.after(() => closeServer(runner));
    const baseUrl = await startOceanBrain(t, openAuth, createGatewayOptions(runnerOrigin));
    const access = await issueGatewayAccess(baseUrl);

    const response = await fetch(`${baseUrl}/apps/search-1/api/private`, {
        method: 'POST',
        headers: { Cookie: access.cookie, Origin: 'null' },
    });

    assert.equal(response.status, 403);
    assert.equal(runnerRequests, 0);
});

test('sandboxed app assets receive CORS without exposing the access token', async (t) => {
    let accessHeader: string | undefined;
    const runner = createServer((request, response) => {
        accessHeader = request.headers[APP_GATEWAY_ACCESS_HEADER] as string | undefined;
        response.setHeader('Content-Type', 'text/javascript');
        response.end('export default true;');
    });
    const runnerOrigin = await listen(runner);
    t.after(() => closeServer(runner));
    const baseUrl = await startOceanBrain(t, openAuth, createGatewayOptions(runnerOrigin));
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

test('managed app gateway rewrites runner redirects to the public app subpath', async (t) => {
    let runnerOrigin = '';
    const runner = createServer((_request, response) => {
        response.statusCode = 302;
        response.setHeader('Location', `${runnerOrigin}/v1/apps/search-1/results?q=ocean`);
        response.end();
    });
    runnerOrigin = await listen(runner);
    t.after(() => closeServer(runner));
    const baseUrl = await startOceanBrain(t, openAuth, createGatewayOptions(runnerOrigin));
    const access = await issueGatewayAccess(baseUrl);

    const response = await fetch(`${baseUrl}/apps/search-1/search`, {
        headers: { Cookie: access.cookie },
        redirect: 'manual',
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/apps/search-1/results?q=ocean');
});

test('managed app gateway canonicalizes an installation root before relative app requests resolve', async (t) => {
    let runnerRequests = 0;
    const runner = createServer((_request, response) => {
        runnerRequests += 1;
        response.end('unexpected');
    });
    const runnerOrigin = await listen(runner);
    t.after(() => closeServer(runner));
    const baseUrl = await startOceanBrain(t, openAuth, createGatewayOptions(runnerOrigin));
    const access = await issueGatewayAccess(baseUrl);

    const response = await fetch(`${baseUrl}/apps/search-1?source=navigation`, {
        headers: { Cookie: access.cookie },
        redirect: 'manual',
    });

    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), '/apps/search-1/?source=navigation');
    assert.equal(runnerRequests, 0);
});

test('managed app gateway blocks anonymous access before contacting the runner', async (t) => {
    let runnerRequests = 0;
    const runner = createServer((_request, response) => {
        runnerRequests += 1;
        response.end('unexpected');
    });
    const runnerOrigin = await listen(runner);
    t.after(() => closeServer(runner));
    const baseUrl = await startOceanBrain(t, passwordAuth, createGatewayOptions(runnerOrigin));

    const response = await fetch(`${baseUrl}/apps/search-1/`);

    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'UNAUTHORIZED');
    assert.equal(runnerRequests, 0);
});

test('managed app gateway blocks disabled installations before contacting the runner', async (t) => {
    let runnerRequests = 0;
    const runner = createServer((_request, response) => {
        runnerRequests += 1;
        response.end('unexpected');
    });
    const runnerOrigin = await listen(runner);
    t.after(() => closeServer(runner));
    let installation = INSTALLATION;
    const baseUrl = await startOceanBrain(
        t,
        openAuth,
        createGatewayOptions(runnerOrigin, async () => installation),
    );
    const access = await issueGatewayAccess(baseUrl);
    installation = { ...INSTALLATION, enabled: false };

    const response = await fetch(`${baseUrl}/apps/search-1/`, { headers: { Cookie: access.cookie } });

    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'APP_INSTALLATION_DISABLED');
    assert.equal(runnerRequests, 0);
});

test('unconfigured app gateway owns the app path instead of falling through to the client', async (t) => {
    const baseUrl = await startOceanBrain(t, openAuth);

    const response = await fetch(`${baseUrl}/apps/search-1/`);

    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'APP_RUNNER_UNAVAILABLE');
});

test('managed app gateway rejects path traversal before it reaches the runner', async (t) => {
    let runnerRequests = 0;
    const runner = createServer((_request, response) => {
        runnerRequests += 1;
        response.end('unexpected');
    });
    const runnerOrigin = await listen(runner);
    t.after(() => closeServer(runner));
    const baseUrl = await startOceanBrain(t, openAuth, createGatewayOptions(runnerOrigin));

    const status = await requestRawPath(baseUrl, '/apps/search-1/dir\\..\\..\\admin');

    assert.equal(status, 400);
    assert.equal(runnerRequests, 0);
});

test('managed app WebSockets use the same runner path and credential boundary', async (t) => {
    let upgradeUrl: string | undefined;
    let upgradeHeaders: IncomingMessage['headers'] | undefined;
    const runner = createServer();
    const runnerSockets = new WebSocketServer({ noServer: true });
    runner.on('upgrade', (request, socket, head) => {
        upgradeUrl = request.url;
        upgradeHeaders = request.headers;
        runnerSockets.handleUpgrade(request, socket, head, (webSocket) => {
            runnerSockets.emit('connection', webSocket, request);
        });
    });
    runnerSockets.on('connection', (socket) => {
        socket.on('message', (data) => socket.send(`echo:${data.toString()}`));
    });
    const runnerOrigin = await listen(runner);
    t.after(async () => {
        runnerSockets.close();
        await closeServer(runner);
    });
    const baseUrl = await startOceanBrain(t, passwordAuth, createGatewayOptions(runnerOrigin));
    const sessionCookie = await login(baseUrl);
    const access = await issueGatewayAccess(baseUrl, sessionCookie);
    const socket = new WebSocket(
        `${baseUrl.replace('http:', 'ws:')}/apps/search-1/live`,
        [APP_GATEWAY_PROTOCOL, `${APP_GATEWAY_ACCESS_PROTOCOL_PREFIX}${access.token}`],
        {
            headers: {
                Authorization: 'Bearer browser-secret',
                Cookie: `${sessionCookie}; ${access.cookie}; unrelated=browser-secret`,
                'X-Ocean-Brain-App-Id': 'spoofed-app',
            },
        },
    );

    await waitForWebSocketOpen(socket);
    socket.send('ping');
    const message = await waitForWebSocketMessage(socket);
    socket.close();
    await waitForWebSocketClose(socket);

    assert.equal(message, 'echo:ping');
    assert.equal(upgradeUrl, '/v1/apps/search-1/live');
    assert.equal(upgradeHeaders?.authorization, `Bearer ${RUNNER_TOKEN}`);
    assert.equal(upgradeHeaders?.cookie, undefined);
    assert.equal(upgradeHeaders?.['sec-websocket-protocol'], APP_GATEWAY_PROTOCOL);
    assert.doesNotMatch(upgradeHeaders?.['sec-websocket-protocol'] ?? '', new RegExp(access.token));
    assert.equal(upgradeHeaders?.['x-ocean-brain-app-id'], INSTALLATION.appId);
    assert.equal(upgradeHeaders?.['x-ocean-brain-installation-id'], INSTALLATION.id);
});
