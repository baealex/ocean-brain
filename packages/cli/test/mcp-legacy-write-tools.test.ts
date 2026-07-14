import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
    LEGACY_UPDATE_NOTE_DESCRIPTION,
    registerLegacyWriteTools,
} from '../src/mcp-legacy-write-tools.js';

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

const UPDATE_NOTE_TOOL_NAME = 'ocean_brain_update_note';

const createFakeMcpServer = () => {
    const registeredTools = new Map<string, RegisteredTool>();
    const server = {
        tool(
            name: string,
            description: string,
            schema: Record<string, unknown>,
            handler: RegisteredTool['handler'],
        ) {
            registeredTools.set(name, { description, schema, handler });
        },
    };

    return {
        registeredTools,
        server: server as unknown as McpServer,
    };
};

const parseToolText = (result: Awaited<ReturnType<RegisteredTool['handler']>>) => {
    return JSON.parse(result.content[0].text) as Record<string, unknown>;
};

describe('registerLegacyWriteTools', () => {
    test('keeps the legacy update tool contract isolated and explicit', () => {
        // Arrange
        const { registeredTools, server } = createFakeMcpServer();

        // Act
        registerLegacyWriteTools(server, {
            jsonRequest: async () => ({ updated: true }),
            requireWriteToken: () => 'write-token',
            serverUrl: 'http://localhost:6683',
            token: 'read-token',
            tools: { updateNote: UPDATE_NOTE_TOOL_NAME },
        });

        // Assert
        const tool = registeredTools.get(UPDATE_NOTE_TOOL_NAME);
        assert.ok(tool);
        assert.equal(tool.description, LEGACY_UPDATE_NOTE_DESCRIPTION);
        assert.deepEqual(Object.keys(tool.schema).sort(), ['id', 'layout', 'markdown', 'title']);
        assert.match(tool.description, /backward compatibility/);
        assert.match(tool.description, /ocean_brain_patch_note_markdown/);
        assert.match(tool.description, /ocean_brain_replace_note_markdown/);
        assert.match(tool.description, /ocean_brain_update_note_metadata/);
        assert.equal(tool.schema.expectedUpdatedAt, undefined);
        assert.equal(tool.schema.baseMarkdownSha256, undefined);
    });

    test('forwards the existing combined update payload and response unchanged', async () => {
        // Arrange
        const { registeredTools, server } = createFakeMcpServer();
        const tokenRequests: Array<{ token: string | undefined; toolName: string }> = [];
        const requests: Array<{
            serverUrl: string;
            token: string | undefined;
            pathName: string;
            body: Record<string, unknown>;
        }> = [];

        registerLegacyWriteTools(server, {
            jsonRequest: async (serverUrl, token, pathName, body) => {
                requests.push({ serverUrl, token, pathName, body });

                return {
                    updated: true,
                    note: {
                        id: '7',
                        title: 'Updated title',
                        layout: 'wide',
                        createdAt: '2026-07-01T00:00:00.000Z',
                        updatedAt: '2026-07-01T00:00:01.000Z',
                    },
                };
            },
            requireWriteToken: (token, toolName) => {
                tokenRequests.push({ token, toolName });
                return 'write-token';
            },
            serverUrl: 'http://localhost:6683',
            token: 'read-token',
            tools: { updateNote: UPDATE_NOTE_TOOL_NAME },
        });
        const handler = registeredTools.get(UPDATE_NOTE_TOOL_NAME)?.handler;

        // Act
        assert.ok(handler);
        const result = parseToolText(
            await handler({
                id: '7',
                title: 'Updated title',
                markdown: '# Updated body',
                layout: 'wide',
            }),
        );

        // Assert
        assert.deepEqual(tokenRequests, [
            {
                token: 'read-token',
                toolName: UPDATE_NOTE_TOOL_NAME,
            },
        ]);
        assert.deepEqual(requests, [
            {
                serverUrl: 'http://localhost:6683',
                token: 'write-token',
                pathName: '/api/mcp/notes/update',
                body: {
                    id: '7',
                    title: 'Updated title',
                    markdown: '# Updated body',
                    layout: 'wide',
                },
            },
        ]);
        assert.equal(result.updated, true);
        assert.deepEqual(result.note, {
            id: '7',
            title: 'Updated title',
            layout: 'wide',
            createdAt: '2026-07-01T00:00:00.000Z',
            updatedAt: '2026-07-01T00:00:01.000Z',
        });
    });
});
