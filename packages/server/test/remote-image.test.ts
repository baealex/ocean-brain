import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

import type { AuthConfig } from '../src/modules/auth-mode.js';
import { createAppWithMcpAuth } from '../src/app.js';
import { fetchRemoteImage, RemoteImageFetchError } from '../src/modules/remote-image.js';

const startServer = async (t: TestContext, authConfig: AuthConfig) => {
    const app = createAppWithMcpAuth(authConfig, { tokens: [] });
    const server = app.listen(0);

    await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    t.after(() => {
        server.close();
    });

    const address = server.address() as AddressInfo;

    return { baseUrl: `http://127.0.0.1:${address.port}` };
};

const jsonRequest = async (
    baseUrl: string,
    path: string,
    method: 'POST',
    body: Record<string, unknown>
) => {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    return {
        status: response.status,
        body: await response.json() as Record<string, unknown>
    };
};

test('fetchRemoteImage rejects invalid protocols before any network fetch', async () => {
    await assert.rejects(
        () => fetchRemoteImage('ftp://cdn.example.com/file.png'),
        (error: unknown) => {
            assert.ok(error instanceof RemoteImageFetchError);
            assert.equal(error.code, 'INVALID_REMOTE_URL');
            assert.equal(error.status, 400);
            return true;
        }
    );
});

test('fetchRemoteImage rejects hosts that resolve to private addresses', async () => {
    await assert.rejects(
        () => fetchRemoteImage('https://cdn.example.com/file.png', { lookupHostname: async () => [{ address: '127.0.0.1' }] }),
        (error: unknown) => {
            assert.ok(error instanceof RemoteImageFetchError);
            assert.equal(error.code, 'REMOTE_URL_BLOCKED');
            assert.equal(error.status, 403);
            return true;
        }
    );
});

test('fetchRemoteImage rejects non-image content types', async () => {
    const response = new Response('hello', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        status: 200
    });

    await assert.rejects(
        () => fetchRemoteImage('https://cdn.example.com/file.png', {
            lookupHostname: async () => [{ address: '93.184.216.34' }],
            fetchImpl: async () => response
        }),
        (error: unknown) => {
            assert.ok(error instanceof RemoteImageFetchError);
            assert.equal(error.code, 'REMOTE_IMAGE_UNSUPPORTED_CONTENT_TYPE');
            assert.equal(error.status, 415);
            return true;
        }
    );
});

test('fetchRemoteImage enforces a byte limit while streaming', async () => {
    const oversizedStream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(new Uint8Array(8));
            controller.enqueue(new Uint8Array(8));
            controller.close();
        }
    });

    const response = new Response(oversizedStream, {
        headers: { 'Content-Type': 'image/png' },
        status: 200
    });

    await assert.rejects(
        () => fetchRemoteImage('https://cdn.example.com/file.png', {
            lookupHostname: async () => [{ address: '93.184.216.34' }],
            fetchImpl: async () => response,
            maxBytes: 10
        }),
        (error: unknown) => {
            assert.ok(error instanceof RemoteImageFetchError);
            assert.equal(error.code, 'REMOTE_IMAGE_TOO_LARGE');
            assert.equal(error.status, 413);
            return true;
        }
    );
});

test('fetchRemoteImage maps request timeouts to a distinct error code', async () => {
    await assert.rejects(
        () => fetchRemoteImage('https://cdn.example.com/file.png', {
            lookupHostname: async () => [{ address: '93.184.216.34' }],
            fetchImpl: async (_input, init) => {
                return new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        const timeoutError = new Error('timed out');
                        timeoutError.name = 'TimeoutError';
                        reject(timeoutError);
                    });
                });
            },
            timeoutMs: 1
        }),
        (error: unknown) => {
            assert.ok(error instanceof RemoteImageFetchError);
            assert.equal(error.code, 'REMOTE_FETCH_TIMEOUT');
            assert.equal(error.status, 504);
            return true;
        }
    );
});

test('fetchRemoteImage returns image bytes for allowed hosts and content types', async () => {
    const buffer = Buffer.from('remote-image-bytes');

    const remoteImage = await fetchRemoteImage('https://cdn.example.com/file.png', {
        lookupHostname: async () => [{ address: '93.184.216.34' }],
        fetchImpl: async () => new Response(buffer, {
            headers: { 'Content-Type': 'image/png' },
            status: 200
        })
    });

    assert.equal(remoteImage.contentType, 'image/png');
    assert.equal(remoteImage.extension, 'png');
    assert.deepEqual(remoteImage.buffer, buffer);
});

test('image-from-src returns a distinct error code for invalid remote urls', async (t) => {
    const { baseUrl } = await startServer(t, {
        mode: 'disabled',
        source: 'override'
    });

    const response = await jsonRequest(baseUrl, '/api/image-from-src', 'POST', { src: 'ftp://cdn.example.com/file.png' });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'INVALID_REMOTE_URL');
});

test('image-from-src blocks direct loopback targets before fetching', async (t) => {
    const { baseUrl } = await startServer(t, {
        mode: 'disabled',
        source: 'override'
    });

    const response = await jsonRequest(baseUrl, '/api/image-from-src', 'POST', { src: 'http://127.0.0.1/file.png' });

    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'REMOTE_URL_BLOCKED');
});
