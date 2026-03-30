import test from 'node:test';
import assert from 'node:assert/strict';

import { createMcpDeleteNoteHandler } from '../src/views/note.js';

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

test('mcp delete note handler rejects invalid note ids', async () => {
    const handler = createMcpDeleteNoteHandler(async () => null);
    const response = createResponse();

    await handler({ body: { id: 'abc' } } as never, response as never);

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
        code: 'INVALID_NOTE_ID',
        message: 'A valid note id is required.'
    });
});

test('mcp delete note handler returns not found when the note is missing', async () => {
    const handler = createMcpDeleteNoteHandler(async () => null);
    const response = createResponse();

    await handler({ body: { id: '11' } } as never, response as never);

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, {
        code: 'NOTE_NOT_FOUND',
        message: 'The requested note was not found.'
    });
});

test('mcp delete note handler returns the deleted note payload', async () => {
    const handler = createMcpDeleteNoteHandler(async () => ({
        id: '7',
        title: 'Temp note',
        updatedAt: '2026-03-30T00:00:00.000Z',
        pinned: false,
        tagNames: ['temp'],
        reminderCount: 0,
        backReferences: [],
        orphanedTagNames: ['temp'],
        requiresForce: true,
        forceReasons: ['orphan_tags']
    }));
    const response = createResponse();

    await handler({ body: { id: '7' } } as never, response as never);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
        deleted: true,
        note: {
            id: '7',
            title: 'Temp note',
            updatedAt: '2026-03-30T00:00:00.000Z',
            pinned: false,
            tagNames: ['temp'],
            reminderCount: 0,
            backReferences: [],
            orphanedTagNames: ['temp'],
            requiresForce: true,
            forceReasons: ['orphan_tags']
        }
    });
});
