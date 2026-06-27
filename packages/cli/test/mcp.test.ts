import assert from 'node:assert/strict';
import test from 'node:test';

import { createMcpRequestHeaders, fetchMcpNoteWriteBaseline, OCEAN_BRAIN_MCP_VERSION_HEADER } from '../src/mcp.js';

test('fetchMcpNoteWriteBaseline requests the side-effect-free MCP HTTP baseline endpoint', async () => {
    const requests: Array<{
        body: Record<string, unknown>;
        pathName: string;
        serverUrl: string;
        token: string | undefined;
    }> = [];

    const note = await fetchMcpNoteWriteBaseline(
        'http://localhost:6683',
        'token-a',
        '7',
        async (serverUrl, token, pathName, body) => {
            requests.push({ serverUrl, token, pathName, body });

            return {
                note: {
                    id: '7',
                    updatedAt: '2026-06-04T10:00:00.000Z',
                },
            };
        },
    );

    assert.deepEqual(note, {
        id: '7',
        updatedAt: '2026-06-04T10:00:00.000Z',
    });
    assert.deepEqual(requests, [
        {
            serverUrl: 'http://localhost:6683',
            token: 'token-a',
            pathName: '/api/mcp/notes/baseline',
            body: {
                id: '7',
            },
        },
    ]);
});

test('createMcpRequestHeaders includes the MCP package version contract header', () => {
    const headers = createMcpRequestHeaders('token-a');

    assert.equal(headers['Content-Type'], 'application/json');
    assert.equal(headers.Authorization, 'Bearer token-a');
    assert.match(headers[OCEAN_BRAIN_MCP_VERSION_HEADER], /^\d+\.\d+\.\d+/);
});
