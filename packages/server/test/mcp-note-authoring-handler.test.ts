import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createMcpCreateNoteHandler,
    createMcpUpdateNoteHandler
} from '../src/views/note.js';

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

test('mcp create note handler rejects missing note title', async () => {
    const handler = createMcpCreateNoteHandler(async () => ({
        id: '1',
        title: 'Title',
        layout: 'wide',
        createdAt: '2026-03-31T00:00:00.000Z',
        updatedAt: '2026-03-31T00:00:00.000Z'
    }));
    const response = createResponse();

    await handler({ body: {} } as never, response as never);

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
        code: 'INVALID_NOTE_TITLE',
        message: 'A note title is required.'
    });
});

test('mcp create note handler returns the created note payload', async () => {
    const handler = createMcpCreateNoteHandler(async () => ({
        id: '3',
        title: 'Draft note',
        layout: 'full',
        createdAt: '2026-03-31T00:00:00.000Z',
        updatedAt: '2026-03-31T00:00:00.000Z'
    }));
    const response = createResponse();

    await handler({ body: { title: 'Draft note', markdown: '# Body', layout: 'full' } } as never, response as never);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
        created: true,
        note: {
            id: '3',
            title: 'Draft note',
            layout: 'full',
            createdAt: '2026-03-31T00:00:00.000Z',
            updatedAt: '2026-03-31T00:00:00.000Z'
        }
    });
});

test('mcp create note handler rejects invalid note layouts', async () => {
    const handler = createMcpCreateNoteHandler(async () => ({
        id: '1',
        title: 'Title',
        layout: 'wide',
        createdAt: '2026-03-31T00:00:00.000Z',
        updatedAt: '2026-03-31T00:00:00.000Z'
    }));
    const response = createResponse();

    await handler({ body: { title: 'Title', layout: 'giant' } } as never, response as never);

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
        code: 'INVALID_NOTE_LAYOUT',
        message: 'Note layout must be one of narrow, wide, or full.'
    });
});

test('mcp update note handler rejects invalid note ids', async () => {
    const handler = createMcpUpdateNoteHandler(async () => null);
    const response = createResponse();

    await handler({ body: { id: 'abc', title: 'Renamed' } } as never, response as never);

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
        code: 'INVALID_NOTE_ID',
        message: 'A valid note id is required.'
    });
});

test('mcp update note handler returns not found when the note is missing', async () => {
    const handler = createMcpUpdateNoteHandler(async () => null);
    const response = createResponse();

    await handler({ body: { id: '7', markdown: 'Updated' } } as never, response as never);

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, {
        code: 'NOTE_NOT_FOUND',
        message: 'The requested note was not found.'
    });
});

test('mcp update note handler returns the updated note payload', async () => {
    const handler = createMcpUpdateNoteHandler(async () => ({
        id: '7',
        title: 'Renamed',
        layout: 'wide',
        createdAt: '2026-03-31T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z'
    }));
    const response = createResponse();

    await handler({ body: { id: '7', title: 'Renamed' } } as never, response as never);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
        updated: true,
        note: {
            id: '7',
            title: 'Renamed',
            layout: 'wide',
            createdAt: '2026-03-31T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z'
        }
    });
});

test('mcp update note handler rejects empty updates', async () => {
    const handler = createMcpUpdateNoteHandler(async () => {
        throw new Error('should not update');
    });
    const response = createResponse();

    await handler({ body: { id: '7' } } as never, response as never);

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
        code: 'INVALID_NOTE_INPUT',
        message: 'At least one note field must be provided for update.'
    });
});
