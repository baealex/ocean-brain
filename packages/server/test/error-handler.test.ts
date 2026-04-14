import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test, { type TestContext } from 'node:test';
import express from 'express';

import { createAppError, createErrorHandler } from '../src/modules/error-handler.js';
import useAsync from '../src/modules/use-async.js';

const startServer = async (t: TestContext) => {
    const app = express();
    const server = app.listen(0);

    await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    t.after(() => {
        server.close();
    });

    const address = server.address() as AddressInfo;

    return {
        app,
        baseUrl: `http://127.0.0.1:${address.port}`,
    };
};

test('error handler returns structured AppError JSON responses', async (t) => {
    const { app, baseUrl } = await startServer(t);

    app.get(
        '/app-error',
        useAsync(async () => {
            throw createAppError(418, 'TEST_ERROR', 'Boom');
        }),
    );
    app.use(createErrorHandler());

    const response = await fetch(`${baseUrl}/app-error`);

    assert.equal(response.status, 418);
    assert.deepEqual(await response.json(), {
        code: 'TEST_ERROR',
        message: 'Boom',
    });
});

test('error handler converts unexpected errors to a standard 500 response', async (t) => {
    const { app, baseUrl } = await startServer(t);

    app.get(
        '/unexpected-error',
        useAsync(async () => {
            throw new Error('Unexpected failure');
        }),
    );
    app.use(createErrorHandler());

    const response = await fetch(`${baseUrl}/unexpected-error`);

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal Server Error',
    });
});
