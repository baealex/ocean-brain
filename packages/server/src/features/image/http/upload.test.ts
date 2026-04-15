import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '~/modules/error-handler.js';
import { RemoteImageFetchError } from '../services/remote-fetch.js';
import { createUploadImageFromSrcHandler, createUploadImageHandler } from './upload.js';

const createResponse = () => {
    const response = {
        statusCode: 200,
        body: undefined as unknown,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(payload: unknown) {
            this.body = payload;
            return this;
        },
        end() {
            return this;
        },
    };

    return response;
};

test('upload image handler rejects invalid data urls', async () => {
    const handler = createUploadImageHandler(async () => ({
        id: 1,
        url: '/assets/images/ignored.png',
    }));

    await assert.rejects(
        () => handler({ body: { image: 'not-a-data-url' } } as never, createResponse() as never),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.status, 400);
            assert.equal(error.code, 'INVALID_IMAGE_UPLOAD');
            return true;
        },
    );
});

test('upload image handler persists decoded image bytes', async () => {
    let receivedExtension = '';
    let receivedBuffer: Uint8Array | null = null;

    const handler = createUploadImageHandler(async (input) => {
        receivedExtension = input.extension;
        receivedBuffer = input.buffer;
        return {
            id: 14,
            url: '/assets/images/2026/4/15/uploaded.png',
        };
    });
    const response = createResponse();

    await handler(
        {
            body: {
                image: `data:image/png;base64,${Buffer.from('image-bytes').toString('base64')}`,
            },
        } as never,
        response as never,
    );

    assert.equal(receivedExtension, 'png');
    assert.deepEqual(receivedBuffer, Buffer.from('image-bytes'));
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
        id: 14,
        url: '/assets/images/2026/4/15/uploaded.png',
    });
});

test('upload image-from-src handler maps remote fetch errors into app errors', async () => {
    const handler = createUploadImageFromSrcHandler(async () => {
        throw new RemoteImageFetchError('REMOTE_URL_BLOCKED', 403, 'Remote image host is not allowed.');
    });

    await assert.rejects(
        () => handler({ body: { src: 'http://127.0.0.1/file.png' } } as never, createResponse() as never),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.status, 403);
            assert.equal(error.code, 'REMOTE_URL_BLOCKED');
            assert.equal(error.message, 'Remote image host is not allowed.');
            return true;
        },
    );
});

test('upload image-from-src handler returns the uploaded image payload', async () => {
    const response = createResponse();

    const handler = createUploadImageFromSrcHandler(
        async () => ({
            buffer: Buffer.from('remote-image'),
            contentType: 'image/png',
            extension: 'png',
        }),
        async () => ({
            id: 21,
            url: '/assets/images/2026/4/15/remote.png',
        }),
    );

    await handler({ body: { src: 'https://cdn.example.com/file.png' } } as never, response as never);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
        id: 21,
        url: '/assets/images/2026/4/15/remote.png',
    });
});
