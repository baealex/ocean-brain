import { fetchLocalDemoMcpAdminStatus } from './client';

describe('fetchLocalDemoMcpAdminStatus', () => {
    it('returns explicit local-only demo version metadata', async () => {
        const status = await fetchLocalDemoMcpAdminStatus();

        expect(status.server.version).toBe('local-demo');
        expect(status.server.mcpVersionRequirement).toBe('unknown');
        expect(status.server.mcp?.compatibilityRequirement).toBe('unknown');
        expect(status.server.releaseUrl).toBe('https://github.com/baealex/ocean-brain/releases');
    });
});
