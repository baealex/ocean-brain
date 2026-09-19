import { buildUnauthorizedPayload } from '@baejino/auth';
import fastifyHttpProxy from '@fastify/http-proxy';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
    APP_GATEWAY_ACCESS_COOKIE_NAME,
    APP_GATEWAY_ACCESS_HEADER,
    APP_GATEWAY_ACCESS_TTL_MS,
    createAppGatewayAccessService,
    extractAppGatewayAccessCookie,
    extractAppGatewayAccessToken,
    selectAppGatewayProtocol,
} from '../features/app-gateway/access.js';
import {
    APP_GATEWAY_PUBLIC_PREFIX,
    type AppGatewayOptions,
    type AppGatewayRequest,
    createGatewayResponseHeaders,
    createProxyRequestHeaders,
    createProxyWebSocketHeaders,
    getAppGatewayUpstream,
    resolveAppGatewayConnection,
    resolveAppGatewayOptions,
    validateAppGatewayRequestPath,
} from '../features/app-gateway/gateway.js';
import { createCsrfProtection, requireSessionForWrite } from '../modules/auth-guard.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import { createAppError } from '../modules/error-handler.js';
import { createSessionAccessRateLimit } from '../modules/rate-limit.js';

const PROXY_PREFIX = `${APP_GATEWAY_PUBLIC_PREFIX}/:connectionId`;
const SUPPORTED_METHODS = 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT';
const CORS_ASSET_DESTINATIONS = new Set(['audio', 'font', 'image', 'manifest', 'script', 'style', 'video', 'worker']);

const getConnectionId = (request: FastifyRequest) => {
    const params = request.params as { connectionId?: unknown };
    return typeof params.connectionId === 'string' ? params.connectionId : '';
};

const isWebSocketUpgrade = (request: FastifyRequest) => request.headers.upgrade?.toLowerCase() === 'websocket';

const getHeaderValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const getPublicProtocol = (request: FastifyRequest): 'http' | 'https' => {
    const origin = getHeaderValue(request.headers.origin);
    if (origin && origin !== 'null') {
        try {
            const url = new URL(origin);
            if (url.host === request.headers.host && (url.protocol === 'http:' || url.protocol === 'https:')) {
                return url.protocol.slice(0, -1) as 'http' | 'https';
            }
        } catch {
            // Origin validation reports malformed values before this helper is used.
        }
    }
    return request.protocol === 'https' ? 'https' : 'http';
};

const requireAllowedOrigin = (request: FastifyRequest) => {
    const origin = request.headers.origin;
    if (!origin || origin === 'null') return;

    try {
        if (new URL(origin).host === request.headers.host) return;
    } catch {
        // Invalid and opaque origins are rejected below.
    }

    throw createAppError(403, 'APP_ORIGIN_FORBIDDEN', 'App requests must originate from Ocean Brain.');
};

const isCorsPreflight = (request: FastifyRequest) =>
    request.method === 'OPTIONS' &&
    request.headers.origin === 'null' &&
    typeof request.headers['access-control-request-method'] === 'string';

const sendCorsPreflight = (request: FastifyRequest, reply: FastifyReply) => {
    const requestedHeaders = request.headers['access-control-request-headers'];
    return reply
        .status(204)
        .headers({
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Headers': requestedHeaders ?? 'Content-Type',
            'Access-Control-Allow-Methods': SUPPORTED_METHODS,
            'Access-Control-Allow-Origin': 'null',
            'Access-Control-Max-Age': '600',
            Vary: 'Origin, Access-Control-Request-Headers',
        })
        .send();
};

export const createAppGatewayRouter = (
    authConfig: AuthConfig,
    gatewayOptions: AppGatewayOptions,
): FastifyPluginAsync => {
    return async (app) => {
        const accessRouteOptions = {
            preHandler: [
                app.rateLimit(createSessionAccessRateLimit()),
                requireSessionForWrite(authConfig),
                createCsrfProtection(authConfig),
            ],
        };
        const options = resolveAppGatewayOptions(gatewayOptions);
        const access = createAppGatewayAccessService();
        const wsClientOptions = {
            headers: {},
            rewriteRequestHeaders: (_headers: Record<string, string>, request: AppGatewayRequest) =>
                createProxyWebSocketHeaders(request),
        };
        app.post<{ Params: { connectionId: string } }>(
            '/api/app-gateway/connections/:connectionId/access',
            accessRouteOptions,
            async (request, reply) => {
                requireAllowedOrigin(request);
                const connection = await resolveAppGatewayConnection(options, request.params.connectionId);
                const grant = access.issue(connection.id, getPublicProtocol(request));
                return reply
                    .header('Cache-Control', 'no-store')
                    .setCookie(APP_GATEWAY_ACCESS_COOKIE_NAME, grant.token, {
                        httpOnly: true,
                        maxAge: APP_GATEWAY_ACCESS_TTL_MS / 1000,
                        path: `${APP_GATEWAY_PUBLIC_PREFIX}/${connection.id}`,
                        // The sandbox has an opaque origin, so app subresources need an explicitly cross-site cookie.
                        sameSite: 'none',
                        secure: true,
                    })
                    .send({
                        connectionId: connection.id,
                        ...grant,
                    });
            },
        );
        // The application-wide form parser turns form bodies into objects before reply-from can forward them.
        // Keep proxied app payloads as streams so the target receives the original bytes for every content type.
        app.removeContentTypeParser('application/x-www-form-urlencoded');
        app.decorateRequest('appGatewayCorsAllowed', false);
        app.decorateRequest('appGatewayConnection', null);
        app.decorateRequest('appGatewayPublicProtocol', null);
        app.register(fastifyHttpProxy, {
            upstream: '',
            prefix: PROXY_PREFIX,
            rewritePrefix: '/',
            websocket: true,
            preHandler: async (request, reply) => {
                validateAppGatewayRequestPath(request.url);
                requireAllowedOrigin(request);
                if (isCorsPreflight(request)) return sendCorsPreflight(request, reply);
                const connectionId = getConnectionId(request);
                const headerToken = getHeaderValue(request.headers[APP_GATEWAY_ACCESS_HEADER]);
                const accessToken = isWebSocketUpgrade(request)
                    ? extractAppGatewayAccessToken(request.headers['sec-websocket-protocol'])
                    : (headerToken ?? extractAppGatewayAccessCookie(request.headers.cookie));
                const accessGrant = access.resolve(connectionId, accessToken);
                if (!accessGrant) {
                    const unauthorized = buildUnauthorizedPayload();
                    throw createAppError(401, unauthorized.code, unauthorized.message);
                }
                request.appGatewayPublicProtocol = accessGrant.publicProtocol;
                request.appGatewayConnection = await resolveAppGatewayConnection(options, connectionId);
                const requestUrl = new URL(request.url, 'http://ocean-brain.invalid');
                const publicRoot = `${APP_GATEWAY_PUBLIC_PREFIX}/${connectionId}`;
                if (
                    !isWebSocketUpgrade(request) &&
                    ['GET', 'HEAD'].includes(request.method) &&
                    requestUrl.pathname === publicRoot
                ) {
                    return reply.redirect(`${publicRoot}/${requestUrl.search}`, 308);
                }
                if (
                    request.headers.origin === 'null' &&
                    !['GET', 'HEAD'].includes(request.method) &&
                    !headerToken &&
                    !isWebSocketUpgrade(request)
                ) {
                    throw createAppError(
                        403,
                        'APP_ACCESS_HEADER_REQUIRED',
                        'Sandboxed app writes require the app access header.',
                    );
                }
                const fetchDestination = request.headers['sec-fetch-dest'];
                request.appGatewayCorsAllowed =
                    request.headers.origin === 'null' &&
                    (Boolean(headerToken) ||
                        (typeof fetchDestination === 'string' && CORS_ASSET_DESTINATIONS.has(fetchDestination)));
            },
            replyOptions: {
                timeout: options.requestTimeoutMs,
                getUpstream: (request) => getAppGatewayUpstream(request as AppGatewayRequest),
                rewriteRequestHeaders: (request, headers) => createProxyRequestHeaders(request, headers),
                rewriteHeaders: (headers, request) =>
                    request ? createGatewayResponseHeaders(headers, request) : headers,
                onError: (reply, { error }) => {
                    const timeout = error.name === 'TimeoutError' || error.message.toLowerCase().includes('timeout');
                    return reply.status(timeout ? 504 : 502).send({
                        code: timeout ? 'APP_PROXY_TIMEOUT' : 'APP_PROXY_UNAVAILABLE',
                        message: timeout
                            ? 'The proxied app did not respond in time.'
                            : 'The proxied app could not be reached.',
                    });
                },
            },
            wsClientOptions,
            wsServerOptions: {
                handleProtocols: selectAppGatewayProtocol,
            },
        });
    };
};
