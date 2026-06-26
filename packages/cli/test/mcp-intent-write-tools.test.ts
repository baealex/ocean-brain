import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, test } from 'node:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
    createIntentWriteOperationFingerprint,
    metadataPropertyPatchSchema,
    registerIntentWriteTools
} from '../src/mcp-intent-write-tools.js';
import { createMcpWriteSafetyCoordinator } from '../src/mcp-write-safety.js';

const payload = {
    id: '7',
    intent: 'Replace one sentence',
    selector: {
        type: 'exact_text',
        text: 'Original sentence.'
    },
    operation: {
        type: 'replace',
        replacement: 'Updated sentence.'
    }
};

interface RegisteredTool {
    handler: (input: Record<string, unknown>) => Promise<{
        content: Array<{
            text: string;
            type: string;
        }>;
    }>;
}

const TOOL_NAMES = {
    appendNoteMarkdown: 'ocean_brain_append_note_markdown',
    patchNoteMarkdown: 'ocean_brain_patch_note_markdown',
    replaceNoteMarkdown: 'ocean_brain_replace_note_markdown',
    updateNoteMetadata: 'ocean_brain_update_note_metadata'
};

const createTempRootDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ocean-brain-mcp-intent-write-tools-'));

const createFakeMcpServer = () => {
    const registeredTools = new Map<string, RegisteredTool>();
    const server = {
        tool(
            name: string,
            _description: string,
            _schema: unknown,
            handler: RegisteredTool['handler']
        ) {
            registeredTools.set(name, { handler });
        }
    };

    return {
        registeredTools,
        server: server as unknown as McpServer
    };
};

const parseToolText = (result: Awaited<ReturnType<RegisteredTool['handler']>>) => {
    return JSON.parse(result.content[0].text) as Record<string, unknown>;
};

describe('createIntentWriteOperationFingerprint', () => {
    test('binds fingerprints to the server URL and bearer token', () => {
        // Arrange
        const base = createIntentWriteOperationFingerprint(
            'http://localhost:6683',
            'token-a',
            'ocean_brain_patch_note_markdown',
            payload
        );

        // Act
        const differentServerUrl = createIntentWriteOperationFingerprint(
            'http://localhost:6684',
            'token-a',
            'ocean_brain_patch_note_markdown',
            payload
        );
        const differentToken = createIntentWriteOperationFingerprint(
            'http://localhost:6683',
            'token-b',
            'ocean_brain_patch_note_markdown',
            payload
        );

        // Assert
        assert.notEqual(differentServerUrl, base);
        assert.notEqual(differentToken, base);
    });

    test('normalizes object key order before fingerprinting', () => {
        // Arrange
        const base = createIntentWriteOperationFingerprint(
            'http://localhost:6683',
            'token-a',
            'ocean_brain_patch_note_markdown',
            payload
        );

        // Act
        const reordered = createIntentWriteOperationFingerprint(
            'http://localhost:6683',
            'token-a',
            'ocean_brain_patch_note_markdown',
            {
                operation: {
                    replacement: 'Updated sentence.',
                    type: 'replace'
                },
                selector: {
                    text: 'Original sentence.',
                    type: 'exact_text'
                },
                intent: 'Replace one sentence',
                id: '7'
            }
        );

        // Assert
        assert.equal(reordered, base);
    });

    test('treats omitted append defaults and explicit append defaults as the same operation', () => {
        // Arrange
        const dryRunPayload = {
            id: '7',
            expectedUpdatedAt: '2026-06-04T10:00:00.000Z',
            intent: 'Append a backlink',
            insertion: 'Related: [[Design Editor]]'
        };

        // Act
        const dryRunFingerprint = createIntentWriteOperationFingerprint(
            'http://localhost:6683',
            'token-a',
            'ocean_brain_append_note_markdown',
            dryRunPayload
        );
        const commitFingerprint = createIntentWriteOperationFingerprint(
            'http://localhost:6683',
            'token-a',
            'ocean_brain_append_note_markdown',
            {
                ...dryRunPayload,
                placement: { type: 'end' },
                separator: '\n\n'
            }
        );

        // Assert
        assert.equal(commitFingerprint, dryRunFingerprint);
    });
});

describe('registerIntentWriteTools', () => {
    test('auto-fetches expectedUpdatedAt and defaults to dry-run when omitted', async () => {
        // Arrange
        const { registeredTools, server } = createFakeMcpServer();
        const requests: Array<{ pathName: string; body: Record<string, unknown> }> = [];
        let baselineFetchCount = 0;

        registerIntentWriteTools(server, {
            fetchNoteWriteBaseline: async (id, token) => {
                baselineFetchCount += 1;
                assert.equal(id, '7');
                assert.equal(token, 'token-a');
                return {
                    id,
                    updatedAt: '2026-06-04T10:00:00.000Z'
                };
            },
            jsonRequest: async (_serverUrl, _token, pathName, body) => {
                requests.push({ pathName, body });

                return {
                    status: 'dry_run',
                    note: {
                        id: '7',
                        title: 'Note',
                        updatedAt: '2026-06-04T10:00:00.000Z'
                    },
                    proposed: {
                        changedLineCount: 1
                    },
                    warnings: []
                };
            },
            requireWriteToken: () => 'token-a',
            serverUrl: 'http://localhost:6683',
            token: 'token-a',
            tools: TOOL_NAMES,
            writeSafety: createMcpWriteSafetyCoordinator({
                rootDir: createTempRootDir(),
                randomBytes: (size) => Buffer.alloc(size, 1)
            })
        });
        const handler = registeredTools.get(TOOL_NAMES.patchNoteMarkdown)?.handler;

        // Act
        assert.ok(handler);
        const result = await handler({
            id: '7',
            intent: 'Patch one sentence',
            selector: {
                type: 'exact_text',
                text: 'Original sentence.'
            },
            operation: {
                type: 'replace',
                replacement: 'Updated sentence.'
            }
        });
        const parsedResult = parseToolText(result);

        // Assert
        assert.equal(baselineFetchCount, 1);
        assert.deepEqual(requests, [
            {
                pathName: '/api/mcp/notes/patch-markdown',
                body: {
                    id: '7',
                    expectedUpdatedAt: '2026-06-04T10:00:00.000Z',
                    intent: 'Patch one sentence',
                    selector: {
                        type: 'exact_text',
                        text: 'Original sentence.'
                    },
                    operation: {
                        type: 'replace',
                        replacement: 'Updated sentence.'
                    },
                    dryRun: true
                }
            }
        ]);
        assert.ok(parsedResult.operation);
    });

    test('skips baseline fetching when a markdown hash baseline is provided', async () => {
        // Arrange
        const { registeredTools, server } = createFakeMcpServer();
        let baselineFetchCount = 0;

        registerIntentWriteTools(server, {
            fetchNoteWriteBaseline: async () => {
                baselineFetchCount += 1;
                return {
                    id: '7',
                    updatedAt: '2026-06-04T10:00:00.000Z'
                };
            },
            jsonRequest: async (_serverUrl, _token, _pathName, body) => {
                assert.equal(body.baseMarkdownSha256, 'hash-a');

                return {
                    status: 'dry_run',
                    note: {
                        id: '7',
                        title: 'Note',
                        updatedAt: '2026-06-04T10:00:00.000Z'
                    },
                    proposed: {
                        changedLineCount: 1
                    },
                    warnings: []
                };
            },
            requireWriteToken: () => 'token-a',
            serverUrl: 'http://localhost:6683',
            token: 'token-a',
            tools: TOOL_NAMES,
            writeSafety: createMcpWriteSafetyCoordinator({ rootDir: createTempRootDir() })
        });
        const handler = registeredTools.get(TOOL_NAMES.appendNoteMarkdown)?.handler;

        // Act
        assert.ok(handler);
        await handler({
            id: '7',
            baseMarkdownSha256: 'hash-a',
            intent: 'Append link',
            insertion: 'Related: [[Design Editor]]'
        });

        // Assert
        assert.equal(baselineFetchCount, 0);
    });

    test('accepts explicit append defaults during commit after dry-run omitted them', async () => {
        // Arrange
        const { registeredTools, server } = createFakeMcpServer();
        const requests: Array<Record<string, unknown>> = [];

        registerIntentWriteTools(server, {
            fetchNoteWriteBaseline: async (id) => ({
                id,
                updatedAt: '2026-06-04T10:00:00.000Z'
            }),
            jsonRequest: async (_serverUrl, _token, _pathName, body) => {
                requests.push(body);

                if (body.dryRun === true) {
                    return {
                        status: 'dry_run',
                        note: {
                            id: '7',
                            title: 'Note',
                            updatedAt: '2026-06-04T10:00:00.000Z'
                        },
                        proposed: {
                            changedLineCount: 1
                        },
                        warnings: []
                    };
                }

                return {
                    status: 'applied',
                    note: {
                        id: '7',
                        updatedAt: '2026-06-04T10:00:01.000Z'
                    }
                };
            },
            requireWriteToken: () => 'token-a',
            serverUrl: 'http://localhost:6683',
            token: 'token-a',
            tools: TOOL_NAMES,
            writeSafety: createMcpWriteSafetyCoordinator({
                rootDir: createTempRootDir(),
                randomBytes: (size) => Buffer.alloc(size, 2)
            })
        });
        const handler = registeredTools.get(TOOL_NAMES.appendNoteMarkdown)?.handler;

        // Act
        assert.ok(handler);
        const dryRunResult = parseToolText(await handler({
            id: '7',
            intent: 'Append link',
            insertion: 'Related: [[Design Editor]]'
        }));
        const operation = dryRunResult.operation as {
            confirmToken: string;
            operationId: string;
        };
        const commitResult = parseToolText(await handler({
            id: '7',
            intent: 'Append link',
            insertion: 'Related: [[Design Editor]]',
            placement: { type: 'end' },
            separator: '\n\n',
            dryRun: false,
            operationId: operation.operationId,
            confirmToken: operation.confirmToken
        }));

        // Assert
        assert.equal(commitResult.status, 'applied');
        assert.equal(requests.length, 2);
        assert.deepEqual(requests[0], {
            id: '7',
            expectedUpdatedAt: '2026-06-04T10:00:00.000Z',
            intent: 'Append link',
            insertion: 'Related: [[Design Editor]]',
            dryRun: true
        });
        assert.deepEqual(requests[1], {
            id: '7',
            expectedUpdatedAt: '2026-06-04T10:00:00.000Z',
            intent: 'Append link',
            insertion: 'Related: [[Design Editor]]',
            placement: { type: 'end' },
            separator: '\n\n',
            dryRun: false
        });
    });

    test('rejects commit mode without confirmation before fetching a baseline', async () => {
        // Arrange
        const { registeredTools, server } = createFakeMcpServer();
        let baselineFetchCount = 0;

        registerIntentWriteTools(server, {
            fetchNoteWriteBaseline: async (id) => {
                baselineFetchCount += 1;
                return {
                    id,
                    updatedAt: '2026-06-04T10:00:00.000Z'
                };
            },
            jsonRequest: async () => {
                throw new Error('jsonRequest should not be called.');
            },
            requireWriteToken: () => 'token-a',
            serverUrl: 'http://localhost:6683',
            token: 'token-a',
            tools: TOOL_NAMES,
            writeSafety: createMcpWriteSafetyCoordinator({ rootDir: createTempRootDir() })
        });
        const handler = registeredTools.get(TOOL_NAMES.patchNoteMarkdown)?.handler;

        // Act & Assert
        assert.ok(handler);
        await assert.rejects(
            () => handler({
                id: '7',
                intent: 'Patch one sentence',
                selector: {
                    type: 'exact_text',
                    text: 'Original sentence.'
                },
                operation: {
                    type: 'replace',
                    replacement: 'Updated sentence.'
                },
                dryRun: false
            }),
            /Commit mode requires both operationId and confirmToken/,
        );
        assert.equal(baselineFetchCount, 0);
    });
});

describe('metadataPropertyPatchSchema', () => {
    test('accepts concise set and delete patches', () => {
        // Arrange
        const patch = {
            set: [{ key: 'state', value: 'todo' }],
            deleteKeys: ['project']
        };

        // Act
        const result = metadataPropertyPatchSchema.safeParse(patch);

        // Assert
        assert.equal(result.success, true);
    });

    test('rejects empty patches', () => {
        // Arrange
        const patch = {};

        // Act
        const result = metadataPropertyPatchSchema.safeParse(patch);

        // Assert
        assert.equal(result.success, false);
    });

    test('rejects duplicate normalized set keys', () => {
        // Arrange
        const patch = {
            set: [
                { key: 'state', value: 'todo' },
                { key: ' State ', value: 'doing' }
            ]
        };

        // Act
        const result = metadataPropertyPatchSchema.safeParse(patch);

        // Assert
        assert.equal(result.success, false);
    });

    test('rejects duplicate normalized delete keys', () => {
        // Arrange
        const patch = {
            deleteKeys: ['state', ' State ']
        };

        // Act
        const result = metadataPropertyPatchSchema.safeParse(patch);

        // Assert
        assert.equal(result.success, false);
    });

    test('rejects setting and deleting the same key', () => {
        // Arrange
        const patch = {
            set: [{ key: 'state', value: 'todo' }],
            deleteKeys: ['state']
        };

        // Act
        const result = metadataPropertyPatchSchema.safeParse(patch);

        // Assert
        assert.equal(result.success, false);
    });

    test('accepts 50 property edits and rejects 51 set or delete entries', () => {
        // Arrange
        const atLimit = 50;
        const overLimit = 51;
        const boundarySetPatch = {
            set: Array.from({ length: atLimit }, (_, index) => ({
                key: `field-${index}`,
                value: 'value'
            }))
        };
        const boundaryDeletePatch = {
            deleteKeys: Array.from({ length: atLimit }, (_, index) => `field-${index}`)
        };
        const setPatch = {
            set: Array.from({ length: overLimit }, (_, index) => ({
                key: `field-${index}`,
                value: 'value'
            }))
        };
        const deletePatch = {
            deleteKeys: Array.from({ length: overLimit }, (_, index) => `field-${index}`)
        };

        // Act
        const boundarySetResult = metadataPropertyPatchSchema.safeParse(boundarySetPatch);
        const boundaryDeleteResult = metadataPropertyPatchSchema.safeParse(boundaryDeletePatch);
        const setResult = metadataPropertyPatchSchema.safeParse(setPatch);
        const deleteResult = metadataPropertyPatchSchema.safeParse(deletePatch);

        // Assert
        assert.equal(boundarySetResult.success, true);
        assert.equal(boundaryDeleteResult.success, true);
        assert.equal(setResult.success, false);
        assert.equal(deleteResult.success, false);
    });
});
