import type { ErrorRequestHandler } from 'express';

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

export const createErrorHandler = (): ErrorRequestHandler => {
    return (error, _req, res, next) => {
        if (res.headersSent) {
            next(error);
            return;
        }

        if (error instanceof AppError) {
            res.status(error.status)
                .json({
                    code: error.code,
                    message: error.message,
                    ...(error.details ? { details: error.details } : {}),
                })
                .end();
            return;
        }

        if (error instanceof Error && error.message.startsWith('CSRF token ')) {
            res.status(403)
                .json({
                    code: 'CSRF_TOKEN_INVALID',
                    message: error.message,
                })
                .end();
            return;
        }

        const message = error instanceof Error ? error.stack || error.message : String(error);
        process.stderr.write(`[error] ${message}\n`);

        res.status(500)
            .json({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Internal Server Error',
            })
            .end();
    };
};
