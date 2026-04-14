import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '~/modules/error-handler.js';
import { InvalidTagNameError } from '../services/organization.js';
import { createMcpCreateTagHandler } from './mcp.js';

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

test('mcp create tag handler rejects missing tag names', async () => {
    const handler = createMcpCreateTagHandler(async () => ({
        created: true,
        normalizedName: '@inbox',
        tag: {
            id: '7',
            name: '@inbox',
            createdAt: '2026-03-31T00:00:00.000Z',
            updatedAt: '2026-03-31T00:00:00.000Z',
        },
    }));
    await assert.rejects(
        () => handler({ body: {} } as never, createResponse() as never),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.status, 400);
            assert.equal(error.code, 'INVALID_TAG_NAME');
            assert.equal(error.message, 'A tag name is required.');
            return true;
        },
    );
});

test('mcp create tag handler returns the created-or-existing tag payload', async () => {
    const handler = createMcpCreateTagHandler(async () => ({
        created: false,
        normalizedName: '@project',
        tag: {
            id: '4',
            name: '@project',
            createdAt: '2026-03-31T00:00:00.000Z',
            updatedAt: '2026-03-31T00:00:00.000Z',
        },
    }));
    const response = createResponse();

    await handler({ body: { name: 'project' } } as never, response as never);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
        created: false,
        normalizedName: '@project',
        tag: {
            id: '4',
            name: '@project',
            createdAt: '2026-03-31T00:00:00.000Z',
            updatedAt: '2026-03-31T00:00:00.000Z',
        },
    });
});

test('mcp create tag handler surfaces invalid normalized tag names', async () => {
    const handler = createMcpCreateTagHandler(async () => {
        throw new InvalidTagNameError('Tag names must be a single token like @project.');
    });
    await assert.rejects(
        () => handler({ body: { name: 'project alpha' } } as never, createResponse() as never),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.status, 400);
            assert.equal(error.code, 'INVALID_TAG_NAME');
            assert.equal(error.message, 'Tag names must be a single token like @project.');
            return true;
        },
    );
});
