import type { IncomingHttpHeaders } from 'node:http';
import type { FastifyRequest, RawServerBase, RequestGenericInterface } from 'fastify';
import { createAppError } from '~/modules/error-handler.js';

export const APP_GATEWAY_PUBLIC_PREFIX = '/apps';
export const APP_RUNNER_PROXY_PREFIX = '/v1/apps';

const APP_IDENTIFIER_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const MIN_RUNNER_TOKEN_LENGTH = 32;

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

export interface AppGatewayInstallation {
    id: string;
    appId: string;
    enabled: boolean;
}

export interface AppGatewayOptions {
    runnerOrigin: string;
    runnerToken: string;
    resolveInstallation: (installationId: string) => Promise<AppGatewayInstallation | null>;
    requestTimeoutMs?: number;
}

export interface ResolvedAppGatewayOptions extends AppGatewayOptions {
    runnerOrigin: string;
    requestTimeoutMs: number;
}

export type AppGatewayRequest = FastifyRequest<RequestGenericInterface, RawServerBase>;

export const isAppIdentifier = (value: string) => APP_IDENTIFIER_PATTERN.test(value);

export const resolveAppGatewayOptions = (options: AppGatewayOptions): ResolvedAppGatewayOptions => {
    let runnerUrl: URL;
    try {
        runnerUrl = new URL(options.runnerOrigin);
    } catch {
        throw new Error('The app runner origin must be a valid absolute URL.');
    }

    if (!['http:', 'https:'].includes(runnerUrl.protocol)) {
        throw new Error('The app runner origin must use HTTP or HTTPS.');
    }
    if (runnerUrl.username || runnerUrl.password || runnerUrl.pathname !== '/' || runnerUrl.search || runnerUrl.hash) {
        throw new Error('The app runner origin cannot contain credentials, a path, a query, or a fragment.');
    }
    if (options.runnerToken.length < MIN_RUNNER_TOKEN_LENGTH) {
        throw new Error(`The app runner token must contain at least ${MIN_RUNNER_TOKEN_LENGTH} characters.`);
    }
    if (typeof options.resolveInstallation !== 'function') {
        throw new Error('The app gateway requires an installation resolver.');
    }

    const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1_000 || requestTimeoutMs > 120_000) {
        throw new Error('The app gateway request timeout must be between 1000 and 120000 milliseconds.');
    }

    return {
        ...options,
        runnerOrigin: runnerUrl.origin,
        requestTimeoutMs,
    };
};

export const resolveGatewayInstallation = async (options: ResolvedAppGatewayOptions, installationId: string) => {
    if (!isAppIdentifier(installationId)) {
        throw createAppError(400, 'INVALID_APP_INSTALLATION_ID', 'The app installation id is invalid.');
    }

    const installation = await options.resolveInstallation(installationId);
    if (!installation) {
        throw createAppError(404, 'APP_INSTALLATION_NOT_FOUND', 'The app installation was not found.');
    }
    if (installation.id !== installationId || !isAppIdentifier(installation.appId)) {
        throw createAppError(502, 'INVALID_APP_RUNNER_STATE', 'The app runner returned an invalid installation.');
    }
    if (!installation.enabled) {
        throw createAppError(503, 'APP_INSTALLATION_DISABLED', 'The app installation is disabled.');
    }

    return installation;
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

const addGatewayHeaders = (
    request: AppGatewayRequest,
    headers: IncomingHttpHeaders,
    options: ResolvedAppGatewayOptions,
) => {
    const installation = request.appGatewayInstallation;
    if (!installation) {
        throw createAppError(502, 'APP_GATEWAY_CONTEXT_MISSING', 'The app gateway request context is missing.');
    }

    return {
        ...headers,
        authorization: `Bearer ${options.runnerToken}`,
        'x-forwarded-host': request.headers.host,
        'x-forwarded-prefix': `${APP_GATEWAY_PUBLIC_PREFIX}/${installation.id}`,
        'x-forwarded-proto': request.appGatewayPublicProtocol ?? request.protocol,
        'x-ocean-brain-app-id': installation.appId,
        'x-ocean-brain-installation-id': installation.id,
    } satisfies IncomingHttpHeaders;
};

export const createRunnerRequestHeaders = (
    request: AppGatewayRequest,
    headers: IncomingHttpHeaders,
    options: ResolvedAppGatewayOptions,
) => addGatewayHeaders(request, withoutBlockedHeaders(headers), options);

export const createRunnerWebSocketHeaders = (request: AppGatewayRequest, options: ResolvedAppGatewayOptions) => {
    const headers: IncomingHttpHeaders = {};
    for (const name of WEBSOCKET_REQUEST_HEADERS) {
        const value = request.headers[name];
        if (value !== undefined) headers[name] = value;
    }
    return addGatewayHeaders(request, headers, options);
};

const getHeader = (headers: IncomingHttpHeaders, name: string) => {
    const value = headers[name];
    return Array.isArray(value) ? value[0] : value;
};

const isWithinPath = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

const rewriteRunnerLocation = (location: string, request: AppGatewayRequest, options: ResolvedAppGatewayOptions) => {
    const installation = request.appGatewayInstallation;
    if (!installation) return undefined;

    const publicPrefix = `${APP_GATEWAY_PUBLIC_PREFIX}/${installation.id}`;
    const runnerPrefix = `${APP_RUNNER_PROXY_PREFIX}/${installation.id}`;
    const requestUrl = new URL(request.url, 'http://ocean-brain.invalid');
    const requestSuffix = isWithinPath(requestUrl.pathname, publicPrefix)
        ? requestUrl.pathname.slice(publicPrefix.length)
        : '/';
    const runnerRequestUrl = new URL(`${runnerPrefix}${requestSuffix}${requestUrl.search}`, options.runnerOrigin);

    let destination: URL;
    try {
        destination = new URL(location, runnerRequestUrl);
    } catch {
        return undefined;
    }

    if (destination.origin !== options.runnerOrigin) return undefined;
    if (isWithinPath(destination.pathname, publicPrefix)) {
        return `${destination.pathname}${destination.search}${destination.hash}`;
    }
    if (!isWithinPath(destination.pathname, runnerPrefix)) return undefined;

    return `${publicPrefix}${destination.pathname.slice(runnerPrefix.length)}${destination.search}${destination.hash}`;
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

export const createGatewayResponseHeaders = (
    source: IncomingHttpHeaders,
    request: AppGatewayRequest,
    options: ResolvedAppGatewayOptions,
) => {
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
        const rewrittenLocation = rewriteRunnerLocation(location, request, options);
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

    if (request.appGatewayCorsAllowed) {
        headers['access-control-allow-origin'] = 'null';
        headers['access-control-allow-credentials'] = 'true';
        headers.vary = appendVary(headers.vary, 'Origin');
    }

    return headers;
};
