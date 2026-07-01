import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
    metadataPropertyPatchSchema,
    registerIntentWriteTools
} from '../src/mcp-intent-write-tools.js';

interface RegisteredTool {
    description: string;
    schema: Record<string, unknown>;
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

const createFakeMcpServer = () => {
    const registeredTools = new Map<string, RegisteredTool>();
    const server = {
        tool(
            name: string,
            _description: string,
            _schema: Record<string, unknown>,
            handler: RegisteredTool['handler']
        ) {
            registeredTools.set(name, { description: _description, schema: _schema, handler });
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

describe('registerIntentWriteTools', () => {
    test('forwards writes without auto-fetching a fresh baseline', async () => {
        // Arrange
        const { registeredTools, server } = createFakeMcpServer();
        const requests: Array<{ pathName: string; body: Record<string, unknown> }> = [];
        registerIntentWriteTools(server, {
            jsonRequest: async (_serverUrl, _token, pathName, body) => {
                requests.push({ pathName, body });

                return {
                    status: 'applied',
                    note: {
                        id: '7',
                        title: 'Note',
                        updatedAt: '2026-06-04T10:00:01.000Z'
                    },
                    change: {
                        changedLineCount: 1
                    }
                };
            },
            requireWriteToken: () => 'token-a',
            serverUrl: 'http://localhost:6683',
            token: 'token-a',
            tools: TOOL_NAMES
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
        assert.deepEqual(requests, [
            {
                pathName: '/api/mcp/notes/patch-markdown',
                body: {
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
                }
            }
        ]);
        assert.equal(parsedResult.status, 'applied');
    });

    test('forwards a markdown hash baseline when provided', async () => {
        // Arrange
        const { registeredTools, server } = createFakeMcpServer();
        registerIntentWriteTools(server, {
            jsonRequest: async (_serverUrl, _token, _pathName, body) => {
                assert.equal(body.baseMarkdownSha256, 'hash-a');

                return {
                    status: 'applied',
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
            tools: TOOL_NAMES
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
    });

    test('applies append directly with explicit append defaults', async () => {
        // Arrange
        const { registeredTools, server } = createFakeMcpServer();
        const requests: Array<Record<string, unknown>> = [];

        registerIntentWriteTools(server, {
            jsonRequest: async (_serverUrl, _token, _pathName, body) => {
                requests.push(body);

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
            tools: TOOL_NAMES
        });
        const handler = registeredTools.get(TOOL_NAMES.appendNoteMarkdown)?.handler;

        // Act
        assert.ok(handler);
        const result = parseToolText(await handler({
            id: '7',
            intent: 'Append link',
            insertion: 'Related: [[Design Editor]]',
            placement: { type: 'end' },
            separator: '\n\n'
        }));

        // Assert
        assert.equal(result.status, 'applied');
        assert.deepEqual(requests, [{
            id: '7',
            intent: 'Append link',
            insertion: 'Related: [[Design Editor]]',
            placement: { type: 'end' },
            separator: '\n\n'
        }]);
    });

    test('describes write tools by edit unit instead of confirmation flow', () => {
        // Arrange
        const { registeredTools, server } = createFakeMcpServer();

        registerIntentWriteTools(server, {
            jsonRequest: async () => ({ status: 'applied' }),
            requireWriteToken: () => 'token-a',
            serverUrl: 'http://localhost:6683',
            token: 'token-a',
            tools: TOOL_NAMES
        });

        // Assert
        assert.match(registeredTools.get(TOOL_NAMES.replaceNoteMarkdown)?.description ?? '', /cat new\.md > note\.md/);
        assert.match(registeredTools.get(TOOL_NAMES.patchNoteMarkdown)?.description ?? '', /`rg`/);
        assert.match(registeredTools.get(TOOL_NAMES.appendNoteMarkdown)?.description ?? '', /cat addition\.md >> note\.md/);
        for (const tool of registeredTools.values()) {
            assert.doesNotMatch(tool.description, /confirmToken|operationId|Dry-run is the default/i);
        }
    });

    test('does not expose confirmation fields in public write tool schemas', () => {
        // Arrange
        const { registeredTools, server } = createFakeMcpServer();

        registerIntentWriteTools(server, {
            jsonRequest: async () => ({ status: 'applied' }),
            requireWriteToken: () => 'token-a',
            serverUrl: 'http://localhost:6683',
            token: 'token-a',
            tools: TOOL_NAMES
        });

        // Assert
        for (const [name, tool] of registeredTools) {
            assert.equal(tool.schema.operationId, undefined, `${name} should not expose operationId`);
            assert.equal(tool.schema.confirmToken, undefined, `${name} should not expose confirmToken`);
            assert.equal(tool.schema.force, undefined, `${name} should not expose force`);
        }
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
