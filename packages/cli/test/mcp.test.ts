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

test('MCP note search forwards the unified search mode and exposes semantic status', async () => {
    const requests: Array<{ query: string; variables: Record<string, unknown> }> = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (_input, init) => {
        requests.push(JSON.parse(String(init?.body)) as (typeof requests)[number]);

        return new Response(JSON.stringify({
            data: {
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
                        contentAsMarkdown: 'Use the hybrid search path.',
                    }],
                },
            },
        }), {
            headers: { 'content-type': 'application/json' },
        });
    }) as typeof fetch;

    const server = new McpServer({ name: 'ocean-brain-test', version: '0.0.0' });
    const client = new Client({ name: 'ocean-brain-test-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    try {
        registerMcpTools(server, 'http://localhost:6683', 'test-token');
        await Promise.all([
            server.connect(serverTransport),
            client.connect(clientTransport),
        ]);

        const result = await client.callTool({
            name: OCEAN_BRAIN_MCP_TOOLS.searchNotes,
            arguments: { query: 'deployment decision', mode: 'semantic' },
        });

        assert.equal(requests.length, 1);
        assert.match(requests[0].query, /searchNotes\(query: \$query, mode: \$mode, pagination: \$pagination\)/);
        assert.deepEqual(requests[0].variables, {
            query: 'deployment decision',
            mode: 'SEMANTIC',
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
            matches: [{ noteId: '17', lexical: false, semantic: true }],
            notes: [{
                id: '17',
                title: 'Deployment decision',
                updatedAt: '2026-07-26T00:00:00.000Z',
                tags: ['@project'],
                preview: 'Use the hybrid search path.',
            }],
        });
    } finally {
        await client.close();
        await server.close();
        globalThis.fetch = originalFetch;
    }
});

test('MCP note search keeps the legacy lexical path when mode is omitted', async () => {
    const requests: Array<{ query: string; variables: Record<string, unknown> }> = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (_input, init) => {
        requests.push(JSON.parse(String(init?.body)) as (typeof requests)[number]);

        return new Response(JSON.stringify({
            data: {
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
            },
        }), {
            headers: { 'content-type': 'application/json' },
        });
    }) as typeof fetch;

    const server = new McpServer({ name: 'ocean-brain-test', version: '0.0.0' });
    const client = new Client({ name: 'ocean-brain-test-client', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    try {
        registerMcpTools(server, 'http://localhost:6683', 'test-token');
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
        globalThis.fetch = originalFetch;
    }
});
