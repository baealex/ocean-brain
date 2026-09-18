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
    APP_RUNNER_PROXY_PREFIX,
    type AppGatewayOptions,
    type AppGatewayRequest,
    createGatewayResponseHeaders,
    createRunnerRequestHeaders,
    createRunnerWebSocketHeaders,
    resolveAppGatewayOptions,
    resolveGatewayInstallation,
    validateAppGatewayRequestPath,
} from '../features/app-gateway/gateway.js';
import { createCsrfProtection, isAuthenticatedRequest, requireSessionForWrite } from '../modules/auth-guard.js';
import type { AuthConfig } from '../modules/auth-mode.js';
import { createAppError } from '../modules/error-handler.js';
import { createSessionAccessRateLimit } from '../modules/rate-limit.js';

const PROXY_PREFIX = `${APP_GATEWAY_PUBLIC_PREFIX}/:installationId`;
const RUNNER_PREFIX = `${APP_RUNNER_PROXY_PREFIX}/:installationId`;
const SUPPORTED_METHODS = 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT';
const CORS_ASSET_DESTINATIONS = new Set(['audio', 'font', 'image', 'manifest', 'script', 'style', 'video', 'worker']);

const getInstallationId = (request: FastifyRequest) => {
    const params = request.params as { installationId?: unknown };
    return typeof params.installationId === 'string' ? params.installationId : '';
};

const requireAppGatewaySession = (authConfig: AuthConfig, request: FastifyRequest) => {
    if (authConfig.mode === 'open' || isAuthenticatedRequest(request)) return;
    const unauthorized = buildUnauthorizedPayload();
    throw createAppError(401, unauthorized.code, unauthorized.message);
};

const isWebSocketUpgrade = (request: FastifyRequest) => request.headers.upgrade?.toLowerCase() === 'websocket';

const getHeaderValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

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

const createUnavailableHandler = (authConfig: AuthConfig) => async (request: FastifyRequest) => {
    requireAllowedOrigin(request);
    requireAppGatewaySession(authConfig, request);
    throw createAppError(503, 'APP_RUNNER_UNAVAILABLE', 'The managed app runner is not configured.');
};

export const createAppGatewayRouter = (
    authConfig: AuthConfig,
    gatewayOptions?: AppGatewayOptions,
): FastifyPluginAsync => {
    return async (app) => {
        const accessRouteOptions = {
            preHandler: [
                app.rateLimit(createSessionAccessRateLimit()),
                requireSessionForWrite(authConfig),
                createCsrfProtection(authConfig),
            ],
        };
        if (!gatewayOptions) {
            const unavailable = createUnavailableHandler(authConfig);
            app.post('/api/app-gateway/installations/:installationId/access', accessRouteOptions, unavailable);
            app.all(PROXY_PREFIX, unavailable);
            app.all(`${PROXY_PREFIX}/*`, unavailable);
            return;
        }

        const options = resolveAppGatewayOptions(gatewayOptions);
        const access = createAppGatewayAccessService();
        const wsClientOptions = {
            headers: {},
            rewriteRequestHeaders: (_headers: Record<string, string>, request: AppGatewayRequest) =>
                createRunnerWebSocketHeaders(request, options),
        };
        app.post<{ Params: { installationId: string } }>(
            '/api/app-gateway/installations/:installationId/access',
            accessRouteOptions,
            async (request, reply) => {
                requireAllowedOrigin(request);
                const installation = await resolveGatewayInstallation(options, request.params.installationId);
                const grant = access.issue(installation.id);
                return reply
                    .header('Cache-Control', 'no-store')
                    .setCookie(APP_GATEWAY_ACCESS_COOKIE_NAME, grant.token, {
                        httpOnly: true,
                        maxAge: APP_GATEWAY_ACCESS_TTL_MS / 1000,
                        path: `${APP_GATEWAY_PUBLIC_PREFIX}/${installation.id}`,
                        // The sandbox has an opaque origin, so app subresources need an explicitly cross-site cookie.
                        sameSite: 'none',
                        secure: true,
                    })
                    .send({
                        installationId: installation.id,
                        ...grant,
                    });
            },
        );
        app.decorateRequest('appGatewayCorsAllowed', false);
        app.decorateRequest('appGatewayInstallation', null);
        app.register(fastifyHttpProxy, {
            upstream: options.runnerOrigin,
            prefix: PROXY_PREFIX,
            rewritePrefix: RUNNER_PREFIX,
            websocket: true,
            preHandler: async (request, reply) => {
                validateAppGatewayRequestPath(request.url);
                requireAllowedOrigin(request);
                if (isCorsPreflight(request)) return sendCorsPreflight(request, reply);
                const installationId = getInstallationId(request);
                const headerToken = getHeaderValue(request.headers[APP_GATEWAY_ACCESS_HEADER]);
                const accessToken = isWebSocketUpgrade(request)
                    ? extractAppGatewayAccessToken(request.headers['sec-websocket-protocol'])
                    : (headerToken ?? extractAppGatewayAccessCookie(request.headers.cookie));
                if (!access.verify(installationId, accessToken)) {
                    const unauthorized = buildUnauthorizedPayload();
                    throw createAppError(401, unauthorized.code, unauthorized.message);
                }
                request.appGatewayInstallation = await resolveGatewayInstallation(options, installationId);
                const requestUrl = new URL(request.url, 'http://ocean-brain.invalid');
                const publicRoot = `${APP_GATEWAY_PUBLIC_PREFIX}/${installationId}`;
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
                rewriteRequestHeaders: (request, headers) => createRunnerRequestHeaders(request, headers, options),
                rewriteHeaders: (headers, request) =>
                    request ? createGatewayResponseHeaders(headers, request, options) : headers,
                onError: (reply, { error }) => {
                    const timeout = error.name === 'TimeoutError' || error.message.toLowerCase().includes('timeout');
                    return reply.status(timeout ? 504 : 502).send({
                        code: timeout ? 'APP_RUNNER_TIMEOUT' : 'APP_RUNNER_UNAVAILABLE',
                        message: timeout
                            ? 'The managed app did not respond in time.'
                            : 'The managed app runner could not be reached.',
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
