import type { Request, Response, NextFunction } from 'express';

declare module 'express-session' {
    interface SessionData {
        authenticated?: boolean;
    }
}

export type Controller = (req: Request, res: Response, next?: NextFunction) => Promise<void>;

export * from './input.js';
