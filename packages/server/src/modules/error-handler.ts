import type { ErrorRequestHandler } from 'express';

export class AppError extends Error {
    code: string;
    status: number;

    constructor(status: number, code: string, message: string) {
        super(message);
        this.name = 'AppError';
        this.status = status;
        this.code = code;
    }
}

export const createAppError = (status: number, code: string, message: string) => {
    return new AppError(status, code, message);
};

export const createErrorHandler = (): ErrorRequestHandler => {
    return (error, _req, res, next) => {
        if (res.headersSent) {
            next(error);
            return;
        }

        if (error instanceof AppError) {
            res.status(error.status).json({
                code: error.code,
                message: error.message
            }).end();
            return;
        }

        const message = error instanceof Error ? error.stack || error.message : String(error);
        process.stderr.write(`[error] ${message}\n`);

        res.status(500).json({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal Server Error'
        }).end();
    };
};
