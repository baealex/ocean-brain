import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyReply } from 'fastify';
import { createApp } from '~/app.js';
import { AUTH_SESSION_COOKIE_NAME, type AuthConfig } from '~/modules/auth-mode.js';
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
        send(body: unknown) {
            this.body = body;
            return this;
        },
    };

    return response as typeof response & FastifyReply;
};

const passwordAuthConfig: AuthConfig = {
    mode: 'password',
    password: 'secret',
    sessionSecret: 'session-secret',
    cookieName: AUTH_SESSION_COOKIE_NAME,
    source: 'password',
};

test('semantic search administration endpoints require an authenticated session', async (t) => {
    const app = createApp(passwordAuthConfig);
    const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
    t.after(() => app.close());
    const providerConfig = {
        enabled: true,
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'qwen-embedding',
        queryInstruction: '',
    };
    const requests: Array<[string, RequestInit?]> = [
        ['/api/search-admin/status'],
        ['/api/search-admin/config', { method: 'POST', body: JSON.stringify(providerConfig) }],
        ['/api/search-admin/models', { method: 'POST', body: JSON.stringify({ baseUrl: providerConfig.baseUrl }) }],
        ['/api/search-admin/test', { method: 'POST', body: JSON.stringify(providerConfig) }],
        ['/api/search-admin/reindex', { method: 'POST' }],
    ];

    for (const [path, init] of requests) {
        const response = await fetch(`${baseUrl}${path}`, {
            ...init,
            headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
        });
        const body = (await response.json()) as { code?: unknown };

        assert.equal(response.status, 401, path);
        assert.equal(body.code, 'UNAUTHORIZED', path);
    }
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

test('search config handler saves an enabled connection without requiring a prior test', async () => {
    let receivedConfig: unknown;
    const handler = createSearchAdminSaveConfigHandler({
        getStatus: async () => {
            throw new Error('not used');
        },
        saveConfig: async (config) => {
            receivedConfig = config;
            return { config } as never;
        },
        testConnection: async () => {
            throw new Error('not used');
        },
        startReindex: async () => {
            throw new Error('not used');
        },
    });

    const response = createResponse();
    const config = {
        enabled: true,
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'qwen-embedding',
        queryInstruction: '',
    };

    await handler(
        {
            body: config,
        } as never,
        response,
    );

    assert.deepEqual(receivedConfig, config);
    assert.equal(response.statusCode, 200);
});

test('connection test forces validation without persisting the supplied settings', async () => {
    let receivedConfig: unknown;
    let receivedApiKeyInput: unknown;
    const handler = createSearchAdminTestConnectionHandler({
        getStatus: async () => {
            throw new Error('not used');
        },
        saveConfig: async () => {
            throw new Error('must not be called');
        },
        testConnection: async (config, apiKeyInput) => {
            receivedConfig = config;
            receivedApiKeyInput = apiKeyInput;
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
                apiKey: 'provider-secret',
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
    assert.deepEqual(receivedApiKeyInput, { provided: true, apiKey: 'provider-secret' });
    assert.equal(response.statusCode, 200);
});

test('model discovery validates the URL before listing provider models', async () => {
    let receivedBaseUrl = '';
    let receivedApiKeyInput: unknown;
    const handler = createSearchAdminListModelsHandler(async (baseUrl, apiKeyInput) => {
        receivedBaseUrl = baseUrl;
        receivedApiKeyInput = apiKeyInput;
        return [{ id: 'text-embedding-qwen3', likelyEmbedding: true }];
    });
    const response = createResponse();

    await handler({ body: { baseUrl: ' http://127.0.0.1:1234/v1/ ', apiKey: 'provider-secret' } } as never, response);

    assert.equal(receivedBaseUrl, 'http://127.0.0.1:1234/v1');
    assert.deepEqual(receivedApiKeyInput, { provided: true, apiKey: 'provider-secret' });
    assert.deepEqual(response.body, {
        models: [{ id: 'text-embedding-qwen3', likelyEmbedding: true }],
    });
    assert.equal(response.statusCode, 200);
});

test('model discovery rejects an oversized URL before provider access', async () => {
    let called = false;
    const handler = createSearchAdminListModelsHandler(async () => {
        called = true;
        return [];
    });

    await assert.rejects(
        handler({ body: { baseUrl: `https://embedding.example.com/${'a'.repeat(2_048)}` } } as never, createResponse()),
        (error: { status?: number; code?: string }) =>
            error.status === 400 && error.code === 'INVALID_EMBEDDING_API_URL',
    );
    assert.equal(called, false);
});
