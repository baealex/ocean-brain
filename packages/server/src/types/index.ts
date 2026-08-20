import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
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
