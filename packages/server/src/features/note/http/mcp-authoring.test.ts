import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '~/modules/error-handler.js';
import {
    createMcpAppendNoteMarkdownHandler,
    createMcpCreateNoteHandler,
    createMcpPatchNoteMarkdownHandler,
    createMcpReplaceNoteMarkdownHandler,
    createMcpUpdateNoteHandler,
    createMcpUpdateNoteMetadataHandler,
} from './mcp.js';

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

test('mcp create note handler rejects missing note title', async () => {
    const handler = createMcpCreateNoteHandler(async () => ({
        id: '1',
        title: 'Title',
        layout: 'wide',
        createdAt: '2026-03-31T00:00:00.000Z',
        updatedAt: '2026-03-31T00:00:00.000Z',
    }));
    await assert.rejects(
        () => handler({ body: {} } as never, createResponse() as never),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.status, 400);
            assert.equal(error.code, 'INVALID_NOTE_TITLE');
            assert.equal(error.message, 'A note title is required.');
            return true;
        },
    );
});

test('mcp create note handler returns the created note payload', async () => {
    const handler = createMcpCreateNoteHandler(async () => ({
        id: '3',
        title: 'Draft note',
        layout: 'full',
        createdAt: '2026-03-31T00:00:00.000Z',
        updatedAt: '2026-03-31T00:00:00.000Z',
    }));
    const response = createResponse();

    await handler(
        {
            body: {
                title: 'Draft note',
                markdown: '# Body',
                layout: 'full',
            },
        } as never,
        response as never,
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
        created: true,
        note: {
            id: '3',
            title: 'Draft note',
            layout: 'full',
            createdAt: '2026-03-31T00:00:00.000Z',
            updatedAt: '2026-03-31T00:00:00.000Z',
        },
    });
});

test('mcp create note handler emits a created server event', async () => {
    const emittedEvents: unknown[] = [];
    const handler = createMcpCreateNoteHandler(
        async () => ({
            id: '3',
            title: 'Draft note',
            layout: 'full',
            createdAt: '2026-03-31T00:00:00.000Z',
            updatedAt: '2026-03-31T00:00:00.000Z',
        }),
        (event) => {
            emittedEvents.push(event);
        },
    );

    await handler(
        {
            body: {
                title: 'Draft note',
            },
        } as never,
        createResponse() as never,
    );

    assert.deepEqual(emittedEvents, [
        {
            type: 'mcp.note.created',
            source: 'mcp',
            noteId: '3',
            updatedAt: '2026-03-31T00:00:00.000Z',
        },
    ]);
});

test('mcp create note handler rejects invalid note layouts', async () => {
    const handler = createMcpCreateNoteHandler(async () => ({
        id: '1',
        title: 'Title',
        layout: 'wide',
        createdAt: '2026-03-31T00:00:00.000Z',
        updatedAt: '2026-03-31T00:00:00.000Z',
    }));
    await assert.rejects(
        () =>
            handler(
                {
                    body: {
                        title: 'Title',
                        layout: 'giant',
                    },
                } as never,
                createResponse() as never,
            ),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.status, 400);
            assert.equal(error.code, 'INVALID_NOTE_LAYOUT');
            assert.equal(error.message, 'Note layout must be one of narrow, wide, or full.');
            return true;
        },
    );
});

test('mcp update note handler rejects invalid note ids', async () => {
    const handler = createMcpUpdateNoteHandler(async () => null);
    await assert.rejects(
        () =>
            handler(
                {
                    body: {
                        id: 'abc',
                        title: 'Renamed',
                    },
                } as never,
                createResponse() as never,
            ),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.status, 400);
            assert.equal(error.code, 'INVALID_NOTE_ID');
            assert.equal(error.message, 'A valid note id is required.');
            return true;
        },
    );
});

test('mcp update note handler returns not found when the note is missing', async () => {
    const handler = createMcpUpdateNoteHandler(async () => null);
    await assert.rejects(
        () =>
            handler(
                {
                    body: {
                        id: '7',
                        markdown: 'Updated',
                    },
                } as never,
                createResponse() as never,
            ),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.status, 404);
            assert.equal(error.code, 'NOTE_NOT_FOUND');
            assert.equal(error.message, 'The requested note was not found.');
            return true;
        },
    );
});

test('mcp update note handler returns the updated note payload', async () => {
    const handler = createMcpUpdateNoteHandler(async () => ({
        id: '7',
        title: 'Renamed',
        layout: 'wide',
        createdAt: '2026-03-31T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
    }));
    const response = createResponse();

    await handler(
        {
            body: {
                id: '7',
                title: 'Renamed',
            },
        } as never,
        response as never,
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
        updated: true,
        note: {
            id: '7',
            title: 'Renamed',
            layout: 'wide',
            createdAt: '2026-03-31T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
        },
    });
});

test('mcp update note handler emits an updated server event', async () => {
    const emittedEvents: unknown[] = [];
    const handler = createMcpUpdateNoteHandler(
        async () => ({
            id: '7',
            title: 'Renamed',
            layout: 'wide',
            createdAt: '2026-03-31T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
        }),
        (event) => {
            emittedEvents.push(event);
        },
    );

    await handler(
        {
            body: {
                id: '7',
                title: 'Renamed',
            },
        } as never,
        createResponse() as never,
    );

    assert.deepEqual(emittedEvents, [
        {
            type: 'mcp.note.updated',
            source: 'mcp',
            noteId: '7',
            updatedAt: '2026-04-01T00:00:00.000Z',
        },
    ]);
});

test('mcp update note handler forwards MCP snapshot metadata without requiring a note version', async () => {
    let receivedInput: unknown;
    const handler = createMcpUpdateNoteHandler(async (input) => {
        receivedInput = input;
        return {
            id: '7',
            title: 'Renamed',
            layout: 'wide',
            createdAt: '2026-03-31T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
        };
    });

    await handler(
        {
            body: {
                id: '7',
                title: 'Renamed',
            },
        } as never,
        createResponse() as never,
    );

    assert.deepEqual(receivedInput, {
        id: 7,
        title: 'Renamed',
        snapshotMeta: '{"entrypoint":"mcp","label":"MCP"}',
    });
});

test('mcp update note handler rejects empty updates', async () => {
    const handler = createMcpUpdateNoteHandler(async () => {
        throw new Error('should not update');
    });
    await assert.rejects(
        () => handler({ body: { id: '7' } } as never, createResponse() as never),
        (error: unknown) => {
            assert.ok(error instanceof AppError);
            assert.equal(error.status, 400);
            assert.equal(error.code, 'INVALID_NOTE_INPUT');
            assert.equal(error.message, 'At least one note field must be provided for update.');
            return true;
        },
    );
});

test('mcp patch note markdown handler forwards validated dry-run input without emitting events', async () => {
    const emittedEvents: unknown[] = [];
    let receivedInput: unknown;
    const handler = createMcpPatchNoteMarkdownHandler(
        async (input) => {
            receivedInput = input;
            return {
                status: 'dry_run',
                note: {
                    id: '7',
                    title: 'Patch target',
                    updatedAt: '2026-04-01T00:00:00.000Z',
                },
                match: {
                    count: 1,
                    lineStart: 2,
                    lineEnd: 2,
                    selectorType: 'exact_text',
                    matchedTextSha256: 'match-hash',
                    surroundingHash: 'surrounding-hash',
                },
                proposed: {
                    changedLineCount: 1,
                    changedCharCount: 6,
                    beforeMarkdownSha256: 'before-hash',
                    afterMarkdownSha256: 'after-hash',
                    diff: '-old\n+new',
                },
                warnings: [],
            };
        },
        (event) => {
            emittedEvents.push(event);
        },
    );
    const response = createResponse();

    await handler(
        {
            body: {
                id: '7',
                expectedUpdatedAt: '2026-04-01T00:00:00.000Z',
                intent: 'Rename old text',
                selector: {
                    type: 'exact_text',
                    text: 'old',
                },
                operation: {
                    type: 'replace',
                    replacement: 'new',
                },
                policy: {
                    preserveTags: 'warn',
                },
                dryRun: true,
            },
        } as never,
        response as never,
    );

    assert.equal(response.statusCode, 200);
    assert.equal((response.body as { status: string }).status, 'dry_run');
    assert.deepEqual(emittedEvents, []);
    assert.deepEqual(receivedInput, {
        id: 7,
        expectedUpdatedAt: '2026-04-01T00:00:00.000Z',
        baseMarkdownSha256: undefined,
        intent: 'Rename old text',
        selector: {
            type: 'exact_text',
            text: 'old',
        },
        operation: {
            type: 'replace',
            replacement: 'new',
        },
        policy: {
            preserveTags: 'warn',
        },
        dryRun: true,
    });
});

test('mcp patch note markdown handler emits an updated event only after apply', async () => {
    const emittedEvents: unknown[] = [];
    const handler = createMcpPatchNoteMarkdownHandler(
        async () => ({
            status: 'applied',
            note: {
                id: '7',
                updatedAt: '2026-04-02T00:00:00.000Z',
            },
            change: {
                summary: 'patched',
                changedLineCount: 1,
                changedCharCount: 6,
            },
            snapshot: {
                id: '12',
                label: 'MCP',
                createdAt: '2026-04-02T00:00:00.000Z',
            },
        }),
        (event) => {
            emittedEvents.push(event);
        },
    );

    await handler(
        {
            body: {
                id: '7',
                intent: 'Rename old text',
                selector: {
                    type: 'exact_text',
                    text: 'old',
                },
                operation: {
                    type: 'replace',
                    replacement: 'new',
                },
                dryRun: false,
            },
        } as never,
        createResponse() as never,
    );

    assert.deepEqual(emittedEvents, [
        {
            type: 'mcp.note.updated',
            source: 'mcp',
            noteId: '7',
            updatedAt: '2026-04-02T00:00:00.000Z',
        },
    ]);
});

test('mcp append note markdown handler validates append placement and separator input', async () => {
    let receivedInput: unknown;
    const handler = createMcpAppendNoteMarkdownHandler(async (input) => {
        receivedInput = input;
        return {
            status: 'dry_run',
            note: {
                id: '7',
                title: 'Append target',
                updatedAt: '2026-04-01T00:00:00.000Z',
            },
            placement: {
                type: 'after_heading',
                heading: 'Decisions',
                level: 2,
            },
            proposed: {
                changedLineCount: 1,
                changedCharCount: 10,
                beforeMarkdownSha256: 'before-hash',
                afterMarkdownSha256: 'after-hash',
                diff: '+New line',
            },
            warnings: [],
        };
    });

    await handler(
        {
            body: {
                id: '7',
                baseMarkdownSha256: 'before-hash',
                intent: 'Append decision',
                insertion: 'New line',
                placement: {
                    type: 'after_heading',
                    heading: 'Decisions',
                    level: 2,
                },
                separator: '\n\n',
                dryRun: true,
            },
        } as never,
        createResponse() as never,
    );

    assert.deepEqual(receivedInput, {
        id: 7,
        expectedUpdatedAt: undefined,
        baseMarkdownSha256: 'before-hash',
        intent: 'Append decision',
        insertion: 'New line',
        placement: {
            type: 'after_heading',
            heading: 'Decisions',
            level: 2,
        },
        separator: '\n\n',
        policy: undefined,
        dryRun: true,
    });
});

test('mcp replace note markdown handler forwards full replacement dry-runs', async () => {
    let receivedInput: unknown;
    const handler = createMcpReplaceNoteMarkdownHandler(async (input) => {
        receivedInput = input;
        return {
            status: 'dry_run',
            note: {
                id: '7',
                title: 'Replace target',
                updatedAt: '2026-04-01T00:00:00.000Z',
            },
            proposed: {
                changedLineCount: 6,
                changedCharCount: 42,
                beforeMarkdownSha256: 'before-hash',
                afterMarkdownSha256: 'after-hash',
                diff: '-old\n+new',
            },
            warnings: ['Full replacement should be reviewed carefully.'],
        };
    });

    await handler(
        {
            body: {
                id: '7',
                expectedUpdatedAt: '2026-04-01T00:00:00.000Z',
                intent: 'Rewrite note',
                replacement: '# New note',
                dryRun: true,
            },
        } as never,
        createResponse() as never,
    );

    assert.deepEqual(receivedInput, {
        id: 7,
        expectedUpdatedAt: '2026-04-01T00:00:00.000Z',
        baseMarkdownSha256: undefined,
        intent: 'Rewrite note',
        replacement: '# New note',
        policy: undefined,
        dryRun: true,
    });
});

test('mcp update note metadata handler requires a baseline and does not emit events for dry-run', async () => {
    const emittedEvents: unknown[] = [];
    let receivedInput: unknown;
    const handler = createMcpUpdateNoteMetadataHandler(
        async (input) => {
            receivedInput = input;
            return {
                status: 'dry_run',
                note: {
                    id: '7',
                    title: 'Old title',
                    updatedAt: '2026-04-01T00:00:00.000Z',
                },
                proposed: {
                    title: 'New title',
                    layout: 'full',
                },
                warnings: [],
            };
        },
        (event) => {
            emittedEvents.push(event);
        },
    );

    await handler(
        {
            body: {
                id: '7',
                expectedUpdatedAt: '2026-04-01T00:00:00.000Z',
                title: 'New title',
                layout: 'full',
                dryRun: true,
            },
        } as never,
        createResponse() as never,
    );

    assert.deepEqual(receivedInput, {
        id: 7,
        expectedUpdatedAt: '2026-04-01T00:00:00.000Z',
        title: 'New title',
        layout: 'full',
        dryRun: true,
    });
    assert.deepEqual(emittedEvents, []);
});

test('mcp update note metadata handler forwards property patches without value types', async () => {
    let receivedInput: unknown;
    const handler = createMcpUpdateNoteMetadataHandler(async (input) => {
        receivedInput = input;
        return {
            status: 'dry_run',
            note: {
                id: '7',
                title: 'Old title',
                updatedAt: '2026-04-01T00:00:00.000Z',
            },
            proposed: {
                properties: {
                    set: [{ key: 'state', name: 'State', value: 'todo', valueType: 'select' }],
                    deleteKeys: ['project'],
                },
            },
            warnings: [],
        };
    });

    await handler(
        {
            body: {
                id: '7',
                expectedUpdatedAt: '2026-04-01T00:00:00.000Z',
                properties: {
                    set: [{ key: 'state', value: 'todo' }],
                    deleteKeys: ['project'],
                },
                dryRun: true,
            },
        } as never,
        createResponse() as never,
    );

    assert.deepEqual(receivedInput, {
        id: 7,
        expectedUpdatedAt: '2026-04-01T00:00:00.000Z',
        properties: {
            set: [{ key: 'state', value: 'todo' }],
            deleteKeys: ['project'],
        },
        dryRun: true,
    });
});
