import test from 'node:test';
import assert from 'node:assert/strict';

import { createMcpDeleteImageHandler } from '../src/views/image.js';

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
        }
    };

    return response;
};

test('mcp delete image handler rejects invalid image ids', async () => {
    const handler = createMcpDeleteImageHandler(async () => null);
    const response = createResponse();

    await handler({ body: { id: 'abc' } } as never, response as never);

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
        code: 'INVALID_IMAGE_ID',
        message: 'A valid image id is required.'
    });
});

test('mcp delete image handler returns not found when the image is missing', async () => {
    const handler = createMcpDeleteImageHandler(async () => null);
    const response = createResponse();

    await handler({ body: { id: '11' } } as never, response as never);

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, {
        code: 'IMAGE_NOT_FOUND',
        message: 'The requested image was not found.'
    });
});

test('mcp delete image handler returns the deleted image payload', async () => {
    const handler = createMcpDeleteImageHandler(async () => ({
        id: '7',
        url: '/assets/images/2026/3/30/test.png',
        referenceCount: 1
    }));
    const response = createResponse();

    await handler({ body: { id: '7' } } as never, response as never);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
        deleted: true,
        image: {
            id: '7',
            url: '/assets/images/2026/3/30/test.png',
            referenceCount: 1
        }
    });
});
