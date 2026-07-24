import assert from 'node:assert/strict';
import test from 'node:test';
import { assertEmbeddingRequestAllowed } from './embedding-request-policy.js';

test('allows public HTTPS and loopback embedding providers', async () => {
    await assert.doesNotReject(
        assertEmbeddingRequestAllowed('https://embedding.example.com/v1/models', {
            resolveHost: async () => ['203.10.20.30'],
        }),
    );
    await assert.doesNotReject(assertEmbeddingRequestAllowed('http://127.0.0.1:1234/v1/models'));
    await assert.doesNotReject(assertEmbeddingRequestAllowed('http://localhost:1234/v1/models'));
});

test('rejects public HTTP and credentials embedded in provider URLs', async () => {
    await assert.rejects(
        assertEmbeddingRequestAllowed('http://embedding.example.com/v1/models', {
            resolveHost: async () => ['203.10.20.30'],
        }),
        /must use HTTPS/,
    );
    await assert.rejects(
        assertEmbeddingRequestAllowed('https://user:secret@embedding.example.com/v1/models', {
            resolveHost: async () => ['203.10.20.30'],
        }),
        /must not contain credentials/,
    );
});
