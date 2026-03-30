import test from 'node:test';
import assert from 'node:assert/strict';

import { createMcpCreateTagHandler } from '../src/views/tag.js';
import { InvalidTagNameError } from '../src/modules/tag-organization.js';

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

test('mcp create tag handler rejects missing tag names', async () => {
    const handler = createMcpCreateTagHandler(async () => ({
        created: true,
        normalizedName: '@inbox',
        tag: {
            id: '7',
            name: '@inbox',
            createdAt: '2026-03-31T00:00:00.000Z',
            updatedAt: '2026-03-31T00:00:00.000Z'
        }
    }));
    const response = createResponse();

    await handler({ body: {} } as never, response as never);

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
        code: 'INVALID_TAG_NAME',
        message: 'A tag name is required.'
    });
});

test('mcp create tag handler returns the created-or-existing tag payload', async () => {
    const handler = createMcpCreateTagHandler(async () => ({
        created: false,
        normalizedName: '@project',
        tag: {
            id: '4',
            name: '@project',
            createdAt: '2026-03-31T00:00:00.000Z',
            updatedAt: '2026-03-31T00:00:00.000Z'
        }
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
            updatedAt: '2026-03-31T00:00:00.000Z'
        }
    });
});

test('mcp create tag handler surfaces invalid normalized tag names', async () => {
    const handler = createMcpCreateTagHandler(async () => {
        throw new InvalidTagNameError('Tag names must be a single token like @project.');
    });
    const response = createResponse();

    await handler({ body: { name: 'project alpha' } } as never, response as never);

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
        code: 'INVALID_TAG_NAME',
        message: 'Tag names must be a single token like @project.'
    });
});
