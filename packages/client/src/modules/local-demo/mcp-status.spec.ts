import { fetchLocalDemoMcpAdminStatus } from './client';

describe('fetchLocalDemoMcpAdminStatus', () => {
    it('returns build version metadata for local-only demo builds', async () => {
        const status = await fetchLocalDemoMcpAdminStatus();

        expect(status.server.version).toMatch(/^\d+\.\d+\.\d+/);
        expect(status.server.mcpVersionRequirement).toMatch(/^\d+\.\d+\.x$/);
        expect(status.server.releaseUrl).toBe('https://github.com/baealex/ocean-brain/releases');
    });
});
