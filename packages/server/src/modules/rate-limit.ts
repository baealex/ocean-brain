import { rateLimit } from 'express-rate-limit';

const AUTH_RATE_LIMIT_MESSAGE = 'Too many authentication attempts. Please try again later.';

export const createAuthAttemptRateLimit = () =>
    rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) => {
            res.status(429).json({
                code: 'AUTH_RATE_LIMITED',
                message: AUTH_RATE_LIMIT_MESSAGE,
            });
        },
    });
