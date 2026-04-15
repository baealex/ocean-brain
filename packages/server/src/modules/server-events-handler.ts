import type { Controller } from '~/types/index.js';
import { serializeServerEvent, subscribeServerEvents } from './server-events.js';

const KEEP_ALIVE_INTERVAL_MS = 30_000;

export const createServerEventsHandler = (): Controller => {
    return async (req, res) => {
        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();
        res.write(': connected\n\n');

        const unsubscribe = subscribeServerEvents((event) => {
            res.write(serializeServerEvent(event));
        });

        const keepAliveTimer = setInterval(() => {
            res.write(': keepalive\n\n');
        }, KEEP_ALIVE_INTERVAL_MS);

        let cleanedUp = false;

        const cleanup = () => {
            if (cleanedUp) {
                return;
            }

            cleanedUp = true;
            clearInterval(keepAliveTimer);
            unsubscribe();
        };

        req.on('close', cleanup);
        res.on('close', cleanup);
    };
};
