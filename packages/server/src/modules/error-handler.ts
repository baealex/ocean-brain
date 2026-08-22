import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildLoginCsrfRedirectPath, isCsrfTokenError, shouldRedirectLoginCsrfFailure } from './auth-guard.js';
import type { AuthConfig } from './auth-mode.js';

export class AppError extends Error {
    code: string;
    status: number;
    details?: unknown;

    constructor(status: number, code: string, message: string, details?: unknown) {
        super(message);
        this.name = 'AppError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

export const createAppError = (status: number, code: string, message: string, details?: unknown) => {
    return new AppError(status, code, message, details);
};

export const createErrorHandler = (authConfig: AuthConfig) => {
    return (error: unknown, request: FastifyRequest, reply: FastifyReply) => {
        if (reply.sent) {
            request.log.error({ error }, 'Error occurred after the response was sent');
            return;
        }

        if (shouldRedirectLoginCsrfFailure(error, request, authConfig)) {
            void reply.redirect(buildLoginCsrfRedirectPath(request), 303);
            return;
        }

        if (error instanceof AppError) {
            void reply.status(error.status).send({
                code: error.code,
                message: error.message,
                ...(error.details ? { details: error.details } : {}),
            });
            return;
        }

        if (isCsrfTokenError(error)) {
            void reply.status(403).send({
                code: 'CSRF_TOKEN_INVALID',
                message: error instanceof Error ? error.message : 'Invalid CSRF token',
            });
            return;
        }

        const message = error instanceof Error ? error.stack || error.message : String(error);
        process.stderr.write(`[error] ${message}\n`);

        void reply.status(500).send({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal Server Error',
        });
    };
};
