import type { Request, Response, NextFunction } from 'express';

declare module 'express-session' {
    interface SessionData {
        user: {
            id: number;
            name: string;
            email: string;
            createdAt: Date;
            updatedAt: Date;
        };
    }
}

export type Controller = (req: Request, res: Response, next?: NextFunction) => Promise<void>;

export * from './input.js';
