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
    return async (req, reply) => {
        reply.hijack();
        const response = reply.raw;
        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        response.setHeader('Cache-Control', 'no-cache, no-transform');
        response.setHeader('Connection', 'keep-alive');
        response.setHeader('X-Accel-Buffering', 'no');
        response.flushHeaders();
        response.write(': connected\n\n');

        const unsubscribe = subscribeServerEvents((event) => {
            response.write(serializeServerEvent(event));
        });

        const keepAliveTimer = setInterval(() => {
            response.write(': keepalive\n\n');
        }, KEEP_ALIVE_INTERVAL_MS);
        keepAliveTimer.unref?.();

        const sessionExpiryTimer = setTimeout(() => {
            response.end();
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

        req.raw.on('close', cleanup);
        response.on('close', cleanup);
    };
};
