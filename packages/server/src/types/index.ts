import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
    interface FastifyRequest {
        appGatewayCorsAllowed?: boolean;
        appGatewayInstallation?: import('../features/app-gateway/gateway.js').AppGatewayInstallation | null;
        appGatewayPublicProtocol?: 'http' | 'https' | null;
        integration?: import('../features/integration/service.js').IntegrationPrincipal;
    }

    interface Session {
        authenticated?: boolean;
    }
}

export type RequestBody = Record<string, unknown>;
export type RequestQuery = Record<string, unknown>;
export type RequestParams = Record<string, string>;

export type HttpRoute = {
    Body: RequestBody;
    Querystring: RequestQuery;
    Params: RequestParams;
};

export type HttpRequest = FastifyRequest<HttpRoute>;

export type Controller = (req: HttpRequest, reply: FastifyReply) => Promise<unknown>;

export * from './input.js';
