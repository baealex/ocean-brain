import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import type { Response } from 'express';
import { createApp } from '~/app.js';
import { AUTH_SESSION_COOKIE_NAME, type AuthConfig } from '~/modules/auth-mode.js';
import { SemanticSearchConnectionNotValidatedError } from '../search-manager.js';
import {
    createSearchAdminListModelsHandler,
    createSearchAdminSaveConfigHandler,
    createSearchAdminTestConnectionHandler,
} from './handlers.js';

const createResponse = () => {
    const response = {
        statusCode: 0,
        body: null as unknown,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(body: unknown) {
            this.body = body;
            return this;
        },
        end() {
            return this;
        },
    };

    return response as typeof response & Response;
};

const passwordAuthConfig: AuthConfig = {
    mode: 'password',
    password: 'secret',
    sessionSecret: 'session-secret',
    cookieName: AUTH_SESSION_COOKIE_NAME,
    source: 'password',
};

test('semantic search administration endpoints require an authenticated session', async (t) => {
    const server = createApp(passwordAuthConfig).listen(0);
    await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    t.after(() => server.close());

    const address = server.address() as AddressInfo;
    const statusResponse = await fetch(`http://127.0.0.1:${address.port}/api/search-admin/status`);
    const statusBody = (await statusResponse.json()) as { code?: unknown };

    assert.equal(statusResponse.status, 401);
    assert.equal(statusBody.code, 'UNAUTHORIZED');

    const modelsResponse = await fetch(`http://127.0.0.1:${address.port}/api/search-admin/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: 'http://127.0.0.1:1234/v1' }),
    });
    const modelsBody = (await modelsResponse.json()) as { code?: unknown };

    assert.equal(modelsResponse.status, 401);
    assert.equal(modelsBody.code, 'UNAUTHORIZED');
});

test('search config handler rejects incomplete external input', async () => {
    const handler = createSearchAdminSaveConfigHandler({
        getStatus: async () => {
            throw new Error('not used');
        },
        saveConfig: async () => {
            throw new Error('must not be called');
        },
        testConnection: async () => {
            throw new Error('not used');
        },
        startReindex: async () => {
            throw new Error('not used');
        },
    });

    await assert.rejects(
        handler({ body: { enabled: true } } as never, createResponse()),
        (error: { status?: number; code?: string }) => error.status === 400 || error.code === 'INVALID_SEARCH_CONFIG',
    );
});

test('search config handler rejects enabling a connection that was never tested', async () => {
    const handler = createSearchAdminSaveConfigHandler({
        getStatus: async () => {
            throw new Error('not used');
        },
        saveConfig: async () => {
            throw new SemanticSearchConnectionNotValidatedError();
        },
        testConnection: async () => {
            throw new Error('not used');
        },
        startReindex: async () => {
            throw new Error('not used');
        },
    });

    await assert.rejects(
        handler(
            {
                body: {
                    enabled: true,
                    baseUrl: 'http://127.0.0.1:1234/v1',
                    model: 'qwen-embedding',
                    queryInstruction: '',
                },
            } as never,
            createResponse(),
        ),
        (error: { status?: number; code?: string }) =>
            error.status === 409 && error.code === 'SEARCH_CONNECTION_NOT_VALIDATED',
    );
});

test('connection test forces validation without persisting the supplied settings', async () => {
    let receivedConfig: unknown;
    const handler = createSearchAdminTestConnectionHandler({
        getStatus: async () => {
            throw new Error('not used');
        },
        saveConfig: async () => {
            throw new Error('must not be called');
        },
        testConnection: async (config) => {
            receivedConfig = config;
            return { ok: true as const, dimensions: 2, model: config?.model ?? '' };
        },
        startReindex: async () => {
            throw new Error('not used');
        },
    });
    const response = createResponse();

    await handler(
        {
            body: {
                baseUrl: 'http://127.0.0.1:1234/v1',
                model: 'qwen-embedding',
                queryInstruction: 'Retrieve relevant notes.',
            },
        } as never,
        response,
    );

    assert.deepEqual(receivedConfig, {
        enabled: true,
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'qwen-embedding',
        queryInstruction: 'Retrieve relevant notes.',
    });
    assert.equal(response.statusCode, 200);
});

test('model discovery validates the URL before listing provider models', async () => {
    let receivedBaseUrl = '';
    const handler = createSearchAdminListModelsHandler(async (baseUrl) => {
        receivedBaseUrl = baseUrl;
        return [{ id: 'text-embedding-qwen3', likelyEmbedding: true }];
    });
    const response = createResponse();

    await handler({ body: { baseUrl: ' http://127.0.0.1:1234/v1/ ' } } as never, response);

    assert.equal(receivedBaseUrl, 'http://127.0.0.1:1234/v1');
    assert.deepEqual(response.body, {
        models: [{ id: 'text-embedding-qwen3', likelyEmbedding: true }],
    });
    assert.equal(response.statusCode, 200);
});
