import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '~/modules/error-handler.js';
import { createUploadImageHandler } from './upload.js';

const PNG_BYTES = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2O4evXqfwAIgQN/QHwrfwAAAABJRU5ErkJggg==',
    'base64',
);

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
                image: `data:image/png;base64,${PNG_BYTES.toString('base64')}`,
            },
        } as never,
        response as never,
    );

    assert.equal(receivedExtension, 'png');
    assert.deepEqual(receivedBuffer, PNG_BYTES);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
        id: 14,
        url: '/assets/images/2026/4/15/uploaded.png',
    });
});

test('upload image handler rejects unsupported image data url content types', async () => {
    const handler = createUploadImageHandler(async () => ({
        id: 1,
        url: '/assets/images/ignored.svg',
    }));

    await assert.rejects(
        () =>
            handler(
                {
                    body: {
                        image: `data:image/svg+xml;base64,${Buffer.from('<svg></svg>').toString('base64')}`,
                    },
                } as never,
                createResponse() as never,
            ),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.status, 415);
            assert.equal(error.code, 'IMAGE_UPLOAD_UNSUPPORTED_TYPE');
            return true;
        },
    );
});

test('upload image handler rejects data urls whose bytes do not match the declared type', async () => {
    const handler = createUploadImageHandler(async () => ({
        id: 1,
        url: '/assets/images/ignored.png',
    }));

    await assert.rejects(
        () =>
            handler(
                {
                    body: {
                        image: `data:image/png;base64,${Buffer.from('not-a-png').toString('base64')}`,
                    },
                } as never,
                createResponse() as never,
            ),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.status, 400);
            assert.equal(error.code, 'INVALID_IMAGE_UPLOAD');
            return true;
        },
    );
});
