import assert from 'node:assert/strict';
import test from 'node:test';

import { issueMcpToken, verifyMcpToken } from '../src/modules/mcp-token.js';

test('issueMcpToken returns plaintext once and a persisted hash', () => {
    const issued = issueMcpToken();

    assert.ok(issued.plaintext.length >= 40);
    assert.notEqual(issued.hash, issued.plaintext);
    assert.equal(verifyMcpToken(issued.hash, issued.plaintext), true);
    assert.equal(verifyMcpToken(issued.hash, 'wrong-token'), false);
});
