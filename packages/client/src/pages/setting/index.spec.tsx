import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { McpAdminStatus } from '~/apis/mcp-admin.api';
import * as mcpAdminApi from '~/apis/mcp-admin.api';
import { createTestQueryClient } from '~/test/test-utils';
import Setting from './index';

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, className, to }: { children: ReactNode; className?: string; to: string }) => (
        <a href={to} className={className}>
            {children}
        </a>
    ),
}));

vi.mock('~/apis/mcp-admin.api', () => ({
    fetchMcpAdminStatus: vi.fn(),
}));

const createMcpStatus = (overrides: Partial<McpAdminStatus> = {}): McpAdminStatus => ({
    enabled: true,
    hasActiveToken: true,
    token: {
        id: '1',
        createdAt: '2026-06-23T00:00:00.000Z',
        lastUsedAt: null,
    },
    server: {
        version: '0.7.3',
        releaseUrl: 'https://github.com/baealex/ocean-brain/releases',
        mcpVersionRequirement: '0.7.x',
        mcp: {
            compatibilityVersion: '0.7.0',
            compatibilityRequirement: '0.7.x',
            compatibilityVersionHeader: 'X-Ocean-Brain-MCP-Compatibility-Version',
            clientVersionHeader: 'X-Ocean-Brain-MCP-Client-Version',
        },
    },
    ...overrides,
});

const renderPage = () => {
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <Setting />
        </QueryClientProvider>,
    );
};

describe('<Setting />', () => {
    it('shows the current server version as secondary footer metadata', async () => {
        vi.mocked(mcpAdminApi.fetchMcpAdminStatus).mockResolvedValue(createMcpStatus());

        renderPage();

        expect(await screen.findByText(/Ocean Brain v0\.7\.3/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Releases' })).toHaveAttribute(
            'href',
            'https://github.com/baealex/ocean-brain/releases',
        );
    });
});
