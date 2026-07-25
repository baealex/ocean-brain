import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createMcpRequestHeaders,
    normalizeOceanBrainTagName,
    OCEAN_BRAIN_MCP_CLIENT_VERSION_HEADER,
    OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION,
    OCEAN_BRAIN_MCP_COMPATIBILITY_VERSION_HEADER,
    OCEAN_BRAIN_MCP_VERSION_HEADER,
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
