import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchRemoteImage, RemoteImageFetchError } from './remote-fetch.js';

test('fetchRemoteImage rejects invalid protocols before any network fetch', async () => {
    await assert.rejects(
        () => fetchRemoteImage('ftp://cdn.example.com/file.png'),
        (error: unknown) => {
            assert.ok(error instanceof RemoteImageFetchError);
            assert.equal(error.code, 'INVALID_REMOTE_URL');
            assert.equal(error.status, 400);
            return true;
        },
    );
});

test('fetchRemoteImage rejects hosts that resolve to private addresses', async () => {
    await assert.rejects(
        () =>
            fetchRemoteImage('https://cdn.example.com/file.png', {
                lookupHostname: async () => [{ address: '127.0.0.1' }],
            }),
        (error: unknown) => {
            assert.ok(error instanceof RemoteImageFetchError);
            assert.equal(error.code, 'REMOTE_URL_BLOCKED');
            assert.equal(error.status, 403);
            return true;
        },
    );
});

test('fetchRemoteImage rejects non-image content types', async () => {
    const response = new Response('hello', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        status: 200,
    });

    await assert.rejects(
        () =>
            fetchRemoteImage('https://cdn.example.com/file.png', {
                lookupHostname: async () => [{ address: '93.184.216.34' }],
                fetchImpl: async () => response,
            }),
        (error: unknown) => {
            assert.ok(error instanceof RemoteImageFetchError);
            assert.equal(error.code, 'REMOTE_IMAGE_UNSUPPORTED_CONTENT_TYPE');
            assert.equal(error.status, 415);
            return true;
        },
    );
});

test('fetchRemoteImage enforces a byte limit while streaming', async () => {
    const oversizedStream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(new Uint8Array(8));
            controller.enqueue(new Uint8Array(8));
            controller.close();
        },
    });

    const response = new Response(oversizedStream, {
        headers: { 'Content-Type': 'image/png' },
        status: 200,
    });

    await assert.rejects(
        () =>
            fetchRemoteImage('https://cdn.example.com/file.png', {
                lookupHostname: async () => [{ address: '93.184.216.34' }],
                fetchImpl: async () => response,
                maxBytes: 10,
            }),
        (error: unknown) => {
            assert.ok(error instanceof RemoteImageFetchError);
            assert.equal(error.code, 'REMOTE_IMAGE_TOO_LARGE');
            assert.equal(error.status, 413);
            return true;
        },
    );
});

test('fetchRemoteImage maps request timeouts to a distinct error code', async () => {
    await assert.rejects(
        () =>
            fetchRemoteImage('https://cdn.example.com/file.png', {
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
                timeoutMs: 1,
            }),
        (error: unknown) => {
            assert.ok(error instanceof RemoteImageFetchError);
            assert.equal(error.code, 'REMOTE_FETCH_TIMEOUT');
            assert.equal(error.status, 504);
            return true;
        },
    );
});

test('fetchRemoteImage returns image bytes for allowed hosts and content types', async () => {
    const buffer = Buffer.from('remote-image-bytes');

    const remoteImage = await fetchRemoteImage('https://cdn.example.com/file.png', {
        lookupHostname: async () => [{ address: '93.184.216.34' }],
        fetchImpl: async () =>
            new Response(buffer, {
                headers: { 'Content-Type': 'image/png' },
                status: 200,
            }),
    });

    assert.equal(remoteImage.contentType, 'image/png');
    assert.equal(remoteImage.extension, 'png');
    assert.deepEqual(remoteImage.buffer, buffer);
});
