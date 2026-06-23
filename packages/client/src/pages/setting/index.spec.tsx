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
    it('shows the current server version and update link on the root settings page', async () => {
        vi.mocked(mcpAdminApi.fetchMcpAdminStatus).mockResolvedValue(createMcpStatus());

        renderPage();

        expect(await screen.findByText('Current version: v0.7.3 / Required MCP version: 0.7.x')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /ocean brain/i })).toHaveAttribute(
            'href',
            'https://github.com/baealex/ocean-brain/releases',
        );
    });
});
