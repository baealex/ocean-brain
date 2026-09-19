import type { IncomingHttpHeaders } from 'node:http';
import type { FastifyRequest, RawServerBase, RequestGenericInterface } from 'fastify';
import { createAppError } from '~/modules/error-handler.js';

export const APP_GATEWAY_PUBLIC_PREFIX = '/apps';

const APP_IDENTIFIER_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

const BLOCKED_REQUEST_HEADERS = new Set([
    'authorization',
    'connection',
    'cookie',
    'forwarded',
    'host',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'x-csrf-token',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-port',
    'x-forwarded-prefix',
    'x-forwarded-proto',
    'x-real-ip',
    'x-xsrf-token',
]);

const WEBSOCKET_REQUEST_HEADERS = ['accept-language', 'origin', 'user-agent'] as const;

export interface AppGatewayConnection {
    id: string;
    integrationId: string;
    enabled: boolean;
    proxyUrl: string | null;
}

export interface ResolvedAppGatewayConnection extends AppGatewayConnection {
    proxyUrl: string;
}

export interface AppGatewayOptions {
    resolveConnection: (connectionId: string) => Promise<AppGatewayConnection | null>;
    requestTimeoutMs?: number;
}

export interface ResolvedAppGatewayOptions extends AppGatewayOptions {
    requestTimeoutMs: number;
}

export type AppGatewayRequest = FastifyRequest<RequestGenericInterface, RawServerBase>;

export const isAppIdentifier = (value: string) => APP_IDENTIFIER_PATTERN.test(value);

export const resolveAppGatewayOptions = (options: AppGatewayOptions): ResolvedAppGatewayOptions => {
    if (typeof options.resolveConnection !== 'function') {
        throw new Error('The app gateway requires a connection resolver.');
    }

    const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1_000 || requestTimeoutMs > 120_000) {
        throw new Error('The app gateway request timeout must be between 1000 and 120000 milliseconds.');
    }

    return { ...options, requestTimeoutMs };
};

const normalizeProxyUrl = (value: string | null) => {
    if (!value) return null;
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return null;
    }
    if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
    ) {
        return null;
    }
    return url.origin;
};

export const resolveAppGatewayConnection = async (
    options: ResolvedAppGatewayOptions,
    connectionId: string,
): Promise<ResolvedAppGatewayConnection> => {
    if (!isAppIdentifier(connectionId)) {
        throw createAppError(400, 'INVALID_APP_CONNECTION_ID', 'The app connection id is invalid.');
    }

    const connection = await options.resolveConnection(connectionId);
    if (!connection) {
        throw createAppError(404, 'APP_CONNECTION_NOT_FOUND', 'The proxied app connection was not found.');
    }
    if (connection.id !== connectionId || !isAppIdentifier(connection.integrationId)) {
        throw createAppError(502, 'INVALID_APP_PROXY_STATE', 'The proxied app connection is invalid.');
    }
    if (!connection.enabled) {
        throw createAppError(503, 'APP_CONNECTION_DISABLED', 'The proxied app connection is disabled.');
    }
    const proxyUrl = normalizeProxyUrl(connection.proxyUrl);
    if (!proxyUrl) {
        throw createAppError(503, 'APP_PROXY_NOT_CONFIGURED', 'The proxied app URL is not configured.');
    }

    return { ...connection, proxyUrl };
};

export const validateAppGatewayRequestPath = (requestUrl: string) => {
    let path = requestUrl.split('?', 1)[0];
    for (let index = 0; index < 3; index += 1) {
        const normalized = path.replaceAll('\\', '/');
        if (/^[a-z][a-z\d+.-]*:/i.test(normalized) || normalized.startsWith('//')) {
            throw createAppError(400, 'INVALID_APP_PROXY_PATH', 'The app request path is invalid.');
        }

        let decoded: string;
        try {
            decoded = decodeURIComponent(normalized);
        } catch {
            throw createAppError(400, 'INVALID_APP_PROXY_PATH', 'The app request path is invalid.');
        }
        if (decoded === '..' || decoded.includes('/..') || decoded.includes('../')) {
            throw createAppError(400, 'INVALID_APP_PROXY_PATH', 'The app request path is invalid.');
        }
        if (decoded === path) break;
        path = decoded;
    }
};

const withoutBlockedHeaders = (headers: IncomingHttpHeaders) => {
    const forwarded: IncomingHttpHeaders = {};
    for (const [name, value] of Object.entries(headers)) {
        const normalizedName = name.toLowerCase();
        if (
            BLOCKED_REQUEST_HEADERS.has(normalizedName) ||
            normalizedName.startsWith('x-forwarded-') ||
            normalizedName.startsWith('x-ocean-brain-')
        ) {
            continue;
        }
        forwarded[normalizedName] = value;
    }
    return forwarded;
};

const addGatewayHeaders = (request: AppGatewayRequest, headers: IncomingHttpHeaders) => {
    const connection = request.appGatewayConnection;
    if (!connection) {
        throw createAppError(502, 'APP_GATEWAY_CONTEXT_MISSING', 'The app gateway request context is missing.');
    }

    return {
        ...headers,
        'x-forwarded-host': request.headers.host,
        'x-forwarded-prefix': `${APP_GATEWAY_PUBLIC_PREFIX}/${connection.id}`,
        'x-forwarded-proto': request.appGatewayPublicProtocol ?? request.protocol,
        'x-ocean-brain-connection-id': connection.id,
        'x-ocean-brain-integration-id': connection.integrationId,
    } satisfies IncomingHttpHeaders;
};

export const createProxyRequestHeaders = (request: AppGatewayRequest, headers: IncomingHttpHeaders) =>
    addGatewayHeaders(request, withoutBlockedHeaders(headers));

export const createProxyWebSocketHeaders = (request: AppGatewayRequest) => {
    const headers: IncomingHttpHeaders = {};
    for (const name of WEBSOCKET_REQUEST_HEADERS) {
        const value = request.headers[name];
        if (value !== undefined) headers[name] = value;
    }
    return addGatewayHeaders(request, headers);
};

export const getAppGatewayUpstream = (request: AppGatewayRequest) => {
    const connection = request.appGatewayConnection;
    if (!connection) {
        throw createAppError(502, 'APP_GATEWAY_CONTEXT_MISSING', 'The app gateway request context is missing.');
    }
    return connection.proxyUrl;
};

const getHeader = (headers: IncomingHttpHeaders, name: string) => {
    const value = headers[name];
    return Array.isArray(value) ? value[0] : value;
};

const isWithinPath = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

const rewriteProxyLocation = (location: string, request: AppGatewayRequest) => {
    const connection = request.appGatewayConnection;
    if (!connection) return undefined;

    const publicPrefix = `${APP_GATEWAY_PUBLIC_PREFIX}/${connection.id}`;
    const requestUrl = new URL(request.url, 'http://ocean-brain.invalid');
    const requestSuffix = isWithinPath(requestUrl.pathname, publicPrefix)
        ? requestUrl.pathname.slice(publicPrefix.length) || '/'
        : '/';
    const upstreamRequestUrl = new URL(`${requestSuffix}${requestUrl.search}`, `${connection.proxyUrl}/`);

    let destination: URL;
    try {
        destination = new URL(location, upstreamRequestUrl);
    } catch {
        return undefined;
    }

    if (destination.origin !== connection.proxyUrl) return undefined;
    if (isWithinPath(destination.pathname, publicPrefix)) {
        return `${destination.pathname}${destination.search}${destination.hash}`;
    }
    return `${publicPrefix}${destination.pathname}${destination.search}${destination.hash}`;
};

const appendVary = (current: string | string[] | undefined, value: string) => {
    const values = new Set(
        (Array.isArray(current) ? current : (current?.split(',') ?? [])).map((item) => item.trim()).filter(Boolean),
    );
    values.add(value);
    return Array.from(values).join(', ');
};

const APP_SANDBOX_POLICY =
    "sandbox allow-downloads allow-forms allow-modals allow-scripts; frame-ancestors 'self'; object-src 'none'";

export const createGatewayResponseHeaders = (source: IncomingHttpHeaders, request: AppGatewayRequest) => {
    const headers = { ...source };
    delete headers['set-cookie'];
    delete headers['set-cookie2'];
    delete headers['x-frame-options'];
    delete headers['content-security-policy-report-only'];
    delete headers['clear-site-data'];
    delete headers.nel;
    delete headers['report-to'];
    delete headers.refresh;
    delete headers['access-control-allow-origin'];
    delete headers['access-control-allow-credentials'];
    delete headers['proxy-authenticate'];
    delete headers['www-authenticate'];

    const location = getHeader(headers, 'location');
    if (location) {
        const rewrittenLocation = rewriteProxyLocation(location, request);
        if (rewrittenLocation) headers.location = rewrittenLocation;
        else delete headers.location;
    }

    const upstreamPolicy = headers['content-security-policy'];
    headers['content-security-policy'] = upstreamPolicy
        ? [...(Array.isArray(upstreamPolicy) ? upstreamPolicy : [upstreamPolicy]), APP_SANDBOX_POLICY]
        : APP_SANDBOX_POLICY;
    headers['permissions-policy'] = 'camera=(), geolocation=(), microphone=(), payment=(), usb=()';
    headers['referrer-policy'] = 'no-referrer';
    headers['x-content-type-options'] = 'nosniff';
    headers['cache-control'] ??= 'private, no-store';

    if (request.appGatewayCorsAllowed) {
        headers['access-control-allow-origin'] = 'null';
        headers['access-control-allow-credentials'] = 'true';
        headers.vary = appendVary(headers.vary, 'Origin');
    }

    return headers;
};
