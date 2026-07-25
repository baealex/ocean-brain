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
    assert.equal(OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION, '0.10.0');
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

        if (query.includes('__type')) {
            return {
                __type: {
                    fields: [{ name: 'contentPreview' }],
                },
            };
        }

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

        assert.equal(requests.length, 4);
        assert.match(requests[0].query, /__type\(name: "Note"\)/);
        assert.deepEqual(
            requests.slice(1).map((request) => request.variables),
            ['HYBRID', 'LEXICAL', 'SEMANTIC'].map((mode) => ({
                query: 'deployment decision',
                mode,
                pagination: { limit: 20, offset: 5 },
            })),
        );
        for (const request of requests.slice(1)) {
            assert.match(request.query, /searchNotes\(query: \$query, mode: \$mode, pagination: \$pagination\)/);
            assert.match(request.query, /contentPreview/);
            assert.doesNotMatch(request.query, /contentAsMarkdown/);
        }
    } finally {
        await client.close();
        await server.close();
    }
});

test('MCP note search falls back to Markdown previews for compatible older servers', async () => {
    const markdown = 'x'.repeat(120);
    const requests: Array<{ query: string; variables?: Record<string, unknown> }> = [];
    const graphqlRequest = async (
        _serverUrl: string,
        _token: string | undefined,
        query: string,
        variables?: Record<string, unknown>,
    ) => {
        requests.push({ query, variables });

        if (query.includes('__type')) {
            return {
                __type: {
                    fields: [{ name: 'contentAsMarkdown' }],
                },
            };
        }

        return {
            searchNotes: {
                totalCount: 1,
                semanticAvailable: true,
                semanticUsed: true,
                semanticError: null,
                matches: [{ noteId: '17', lexical: false, semantic: true }],
                notes: [{
                    id: '17',
                    title: 'Older server',
                    updatedAt: '2026-07-26T00:00:00.000Z',
                    tags: [],
                    contentAsMarkdown: markdown,
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
            arguments: { query: 'older server', mode: 'semantic' },
        });

        assert.equal(requests.length, 2);
        assert.match(requests[1].query, /contentAsMarkdown/);
        assert.doesNotMatch(requests[1].query, /contentPreview/);

        const content = result.content[0];
        assert.equal(content?.type, 'text');
        if (content?.type !== 'text') {
            throw new Error('Expected a text MCP result.');
        }
        assert.equal(JSON.parse(content.text).notes[0].preview, 'x'.repeat(100));
    } finally {
        await client.close();
        await server.close();
    }
});

test('MCP note search keeps the legacy request and response when mode is omitted', async () => {
    const requests: Array<{ query: string; variables?: Record<string, unknown> }> = [];
    const graphqlRequest = async (
        _serverUrl: string,
        _token: string | undefined,
        query: string,
        variables?: Record<string, unknown>,
    ) => {
        requests.push({ query, variables });

        return {
            allNotes: {
                totalCount: 1,
                notes: [{
                    id: '23',
                    title: 'Legacy search',
                    updatedAt: '2026-07-26T00:00:00.000Z',
                    tags: [{ id: '2', name: '@legacy' }],
                    contentAsMarkdown: 'Keep the old search behavior.',
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
            arguments: { query: 'legacy search' },
        });

        assert.equal(requests.length, 1);
        assert.match(requests[0].query, /allNotes\(searchFilter: \$searchFilter, pagination: \$pagination\)/);
        assert.doesNotMatch(requests[0].query, /searchNotes/);
        assert.deepEqual(requests[0].variables, {
            searchFilter: { query: 'legacy search', sortBy: 'updatedAt', sortOrder: 'desc' },
            pagination: { limit: 10, offset: 0 },
        });

        const content = result.content[0];
        assert.equal(content?.type, 'text');
        if (content?.type !== 'text') {
            throw new Error('Expected a text MCP result.');
        }

        assert.deepEqual(JSON.parse(content.text), {
            totalCount: 1,
            notes: [{
                id: '23',
                title: 'Legacy search',
                updatedAt: '2026-07-26T00:00:00.000Z',
                tags: ['@legacy'],
                preview: 'Keep the old search behavior.',
            }],
        });
    } finally {
        await client.close();
        await server.close();
    }
});
