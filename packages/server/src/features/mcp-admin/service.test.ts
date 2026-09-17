import assert from 'node:assert/strict';
import test from 'node:test';
import { createIntegrationService } from '../integration/service.js';
import { createMcpAdminService } from './service.js';

test('MCP administration uses the native integration connection and credentials', async () => {
    const integrations = createIntegrationService();
    const mcp = createMcpAdminService(integrations);
    await mcp.revokeActiveToken();
    await mcp.setEnabled(false);
    assert.deepEqual(await mcp.getStatus(), { enabled: false, hasActiveToken: false, token: null });
    assert.deepEqual(await mcp.validatePresentedToken('missing'), { ok: false, reason: 'not_configured' });
    await mcp.setEnabled(true);
    const first = await mcp.rotateToken();
    assert.equal((await integrations.get('mcp')).enabled, true);
    assert.equal((await mcp.validatePresentedToken(first.token)).ok, true);
    assert.ok((await mcp.getStatus()).token?.lastUsedAt);
    await integrations.update('mcp', { grantedPermissions: ['notes:read'] });
    assert.deepEqual(await mcp.validatePresentedToken(first.token), { ok: true, permissions: ['notes:read'] });
    const second = await mcp.rotateToken();
    assert.deepEqual(await mcp.validatePresentedToken(first.token), { ok: false, reason: 'forbidden' });
    assert.equal((await mcp.validatePresentedToken(second.token)).ok, true);
    await integrations.update('mcp', { enabled: false });
    assert.equal((await mcp.getStatus()).enabled, false);
    assert.equal((await mcp.validatePresentedToken(second.token)).ok, false);
    await mcp.revokeActiveToken();
    assert.equal((await mcp.getStatus()).hasActiveToken, false);
});
