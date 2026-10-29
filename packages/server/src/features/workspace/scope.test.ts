import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertSameWorkspace, normalizeWorkspaceScope, parseWorkspaceId } from './scope.js';

test('omitted scope preserves global reads and explicit scope identifies one workspace', () => {
    assert.equal(normalizeWorkspaceScope(), null);
    assert.equal(normalizeWorkspaceScope({ kind: 'all' }), null);
    assert.equal(normalizeWorkspaceScope({ kind: 'workspace', workspaceId: '2' }), 2);
});

test('ambiguous scope and malformed workspace IDs never fall back to another space', () => {
    for (const value of ['', '01', 'all', '2x', 0, -1, null, true, 2_147_483_648]) {
        assert.throws(() => parseWorkspaceId(value));
    }
    assert.throws(() => normalizeWorkspaceScope({ kind: 'all', workspaceId: '2' }));
    assert.throws(() => normalizeWorkspaceScope({ kind: 'workspace' }));
    assert.throws(() => assertSameWorkspace(2, 3));
});
