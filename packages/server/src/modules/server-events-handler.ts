import type { Controller } from '~/types/index.js';
import { serializeServerEvent, subscribeServerEvents } from './server-events.js';
import { AUTH_SESSION_IDLE_TIMEOUT_MS } from './session-store.js';

const KEEP_ALIVE_INTERVAL_MS = 30_000;

const getEventStreamLifetimeMs = (expires?: Date | string | null) => {
    if (!expires) {
        return AUTH_SESSION_IDLE_TIMEOUT_MS;
    }

    const expiresAt = expires instanceof Date ? expires : new Date(expires);

    if (Number.isNaN(expiresAt.getTime())) {
        return AUTH_SESSION_IDLE_TIMEOUT_MS;
    }

    return Math.max(0, Math.min(expiresAt.getTime() - Date.now(), AUTH_SESSION_IDLE_TIMEOUT_MS));
};

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
        keepAliveTimer.unref?.();

        const sessionExpiryTimer = setTimeout(() => {
            res.end();
        }, getEventStreamLifetimeMs(req.session?.cookie.expires));
        sessionExpiryTimer.unref?.();

        let cleanedUp = false;

        const cleanup = () => {
            if (cleanedUp) {
                return;
            }

            cleanedUp = true;
            clearInterval(keepAliveTimer);
            clearTimeout(sessionExpiryTimer);
            unsubscribe();
        };

        req.on('close', cleanup);
        res.on('close', cleanup);
    };
};
