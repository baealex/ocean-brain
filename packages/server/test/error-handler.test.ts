import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';

import { createAppError, createErrorHandler } from '../src/modules/error-handler.js';

const openAuthConfig = {
    mode: 'open' as const,
    cookieName: 'ocean-brain.sid',
    source: 'explicit-open' as const,
};

const startServer = async (t: TestContext, registerRoutes: (app: FastifyInstance) => void) => {
    const app = Fastify({ logger: false });
    registerRoutes(app);
    app.setErrorHandler(createErrorHandler(openAuthConfig));
    const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });

    t.after(() => app.close());

    return baseUrl;
};

test('error handler returns structured AppError JSON responses', async (t) => {
    const baseUrl = await startServer(t, (app) => {
        app.get('/app-error', async () => {
            throw createAppError(418, 'TEST_ERROR', 'Boom');
        });
    });

    const response = await fetch(`${baseUrl}/app-error`);

    assert.equal(response.status, 418);
    assert.deepEqual(await response.json(), {
        code: 'TEST_ERROR',
        message: 'Boom',
    });
});

test('error handler converts unexpected errors to a standard 500 response', async (t) => {
    const baseUrl = await startServer(t, (app) => {
        app.get('/unexpected-error', async () => {
            throw new Error('Unexpected failure');
        });
    });

    const response = await fetch(`${baseUrl}/unexpected-error`);

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal Server Error',
    });
});
