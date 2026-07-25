import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveEmbeddingRuntimeConfig } from './embedding-runtime-config.js';

test('reads trusted private origins from the server environment', () => {
    assert.deepEqual(
        resolveEmbeddingRuntimeConfig({
            OCEAN_BRAIN_EMBEDDING_ALLOWED_ORIGINS:
                'http://embedding.internal:1234, http://192.168.1.20:8080, http://embedding.internal:1234',
        }),
        {
            allowedOrigins: ['http://embedding.internal:1234', 'http://192.168.1.20:8080'],
        },
    );
});

test('rejects paths and credentials in the trusted origin list', () => {
    assert.throws(
        () =>
            resolveEmbeddingRuntimeConfig({
                OCEAN_BRAIN_EMBEDDING_ALLOWED_ORIGINS: 'https://embedding.internal/v1',
            }),
        /only a scheme, hostname, and optional port/,
    );
    assert.throws(
        () =>
            resolveEmbeddingRuntimeConfig({
                OCEAN_BRAIN_EMBEDDING_ALLOWED_ORIGINS: 'https://user:secret@embedding.internal',
            }),
        /only a scheme, hostname, and optional port/,
    );
});
