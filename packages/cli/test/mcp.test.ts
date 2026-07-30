import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
    createMcpRequestHeaders,
    normalizeOceanBrainTagName,
    OCEAN_BRAIN_MCP_CLIENT_VERSION_HEADER,
    OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION,
    OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION_HEADER,
    OCEAN_BRAIN_MCP_VERSION_HEADER,
    OCEAN_BRAIN_MCP_TOOLS,
    registerMcpTools,
} from '../src/mcp.js';

test('createMcpRequestHeaders includes MCP compatibility and client version headers', () => {
    const headers = createMcpRequestHeaders('token-a');

    assert.equal(headers['Content-Type'], 'application/json');
    assert.equal(headers.Authorization, 'Bearer token-a');
    assert.equal(OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION, '0.11.0');
    assert.equal(headers[OCEAN_BRAIN_MCP_VERSION_HEADER], OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION);
    assert.equal(headers[OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION_HEADER], OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION);
    assert.match(headers[OCEAN_BRAIN_MCP_CLIENT_VERSION_HEADER], /^\d+\.\d+\.\d+/);
});

test('normalizeOceanBrainTagName rejects hash-prefixed tags', () => {
    assert.throws(() => normalizeOceanBrainTagName('#project'), /use @, not #/);
    assert.equal(normalizeOceanBrainTagName('project'), '@project');
    assert.equal(normalizeOceanBrainTagName('@project'), '@project');
});

test('MCP note search gives every explicit mode one result contract with pagination', async () => {
    const requests: Array<{ query: string; variables?: Record<string, unknown> }> = [];
    const graphqlRequest = async (
        _serverUrl: string,
        _token: string | undefined,
        query: string,
        variables?: Record<string, unknown>,
    ) => {
        requests.push({ query, variables });

        return {
            searchNotes: {
                totalCount: 1,
                semanticAvailable: true,
                semanticUsed: true,
                semanticError: null,
                matches: [{ noteId: '17', lexical: false, semantic: true }],
                notes: [{
                    id: '17',
                    title: 'Deployment decision',
                    updatedAt: '2026-07-26T00:00:00.000Z',
                    tags: [{ id: '1', name: '@project' }],
                    contentPreview: 'Use the hybrid search path.',
                }],
            },
        };
    };

    const server = new McpServer({ name: 'ocean-brain-test', version: '0.0.0' });
    const client = new Client({ name: 'ocean-brain-test-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    try {
        registerMcpTools(server, 'http://localhost:6683', 'test-token', { graphqlRequest });
        await Promise.all([
            server.connect(serverTransport),
            client.connect(clientTransport),
        ]);

        for (const mode of ['hybrid', 'lexical', 'semantic'] as const) {
            const result = await client.callTool({
                name: OCEAN_BRAIN_MCP_TOOLS.searchNotes,
                arguments: {
                    query: 'deployment decision',
                    mode,
                    limit: 20,
                    offset: 5,
                },
            });

            const content = result.content[0];
            assert.equal(content?.type, 'text');
            if (content?.type !== 'text') {
                throw new Error('Expected a text MCP result.');
            }

            assert.deepEqual(JSON.parse(content.text), {
                totalCount: 1,
                semanticAvailable: true,
                semanticUsed: true,
                semanticError: null,
                matches: [{ noteId: '17', lexical: false, semantic: true }],
                notes: [{
                    id: '17',
                    title: 'Deployment decision',
                    updatedAt: '2026-07-26T00:00:00.000Z',
                    tags: ['@project'],
                    preview: 'Use the hybrid search path.',
                }],
            });
        }

        assert.equal(requests.length, 3);
        assert.deepEqual(
            requests.map((request) => request.variables),
            ['HYBRID', 'LEXICAL', 'SEMANTIC'].map((mode) => ({
                query: 'deployment decision',
                mode,
                pagination: { limit: 20, offset: 5 },
            })),
        );
        for (const request of requests) {
            assert.match(request.query, /searchNotes\(query: \$query, mode: \$mode, pagination: \$pagination\)/);
            assert.match(request.query, /contentPreview/);
            assert.doesNotMatch(request.query, /contentAsMarkdown/);
        }
    } finally {
        await client.close();
        await server.close();
    }
});

test('MCP note search defaults to hybrid mode when mode is omitted', async () => {
    const requests: Array<{ query: string; variables?: Record<string, unknown> }> = [];
    const graphqlRequest = async (
        _serverUrl: string,
        _token: string | undefined,
        query: string,
        variables?: Record<string, unknown>,
    ) => {
        requests.push({ query, variables });

        return {
            searchNotes: {
                totalCount: 1,
                semanticAvailable: true,
                semanticUsed: true,
                semanticError: null,
                matches: [{ noteId: '23', lexical: true, semantic: true }],
                notes: [{
                    id: '23',
                    title: 'Hybrid search',
                    updatedAt: '2026-07-26T00:00:00.000Z',
                    tags: [{ id: '2', name: '@search' }],
                    contentPreview: 'Use the new hybrid search contract.',
                }],
            },
        };
    };

    const server = new McpServer({ name: 'ocean-brain-test', version: '0.0.0' });
    const client = new Client({ name: 'ocean-brain-test-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    try {
        registerMcpTools(server, 'http://localhost:6683', 'test-token', { graphqlRequest });
        await Promise.all([
            server.connect(serverTransport),
            client.connect(clientTransport),
        ]);

        const result = await client.callTool({
            name: OCEAN_BRAIN_MCP_TOOLS.searchNotes,
            arguments: { query: 'hybrid search' },
        });

        assert.equal(requests.length, 1);
        assert.match(requests[0].query, /searchNotes\(query: \$query, mode: \$mode, pagination: \$pagination\)/);
        assert.match(requests[0].query, /contentPreview/);
        assert.doesNotMatch(requests[0].query, /contentAsMarkdown/);
        assert.deepEqual(requests[0].variables, {
            query: 'hybrid search',
            mode: 'HYBRID',
            pagination: { limit: 10, offset: 0 },
        });

        const content = result.content[0];
        assert.equal(content?.type, 'text');
        if (content?.type !== 'text') {
            throw new Error('Expected a text MCP result.');
        }

        assert.deepEqual(JSON.parse(content.text), {
            totalCount: 1,
            semanticAvailable: true,
            semanticUsed: true,
            semanticError: null,
            matches: [{ noteId: '23', lexical: true, semantic: true }],
            notes: [{
                id: '23',
                title: 'Hybrid search',
                updatedAt: '2026-07-26T00:00:00.000Z',
                tags: ['@search'],
                preview: 'Use the new hybrid search contract.',
            }],
        });
    } finally {
        await client.close();
        await server.close();
    }
});
