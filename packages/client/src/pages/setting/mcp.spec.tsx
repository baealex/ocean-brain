import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { McpAdminStatus } from '~/apis/mcp-admin.api';
import * as mcpAdminApi from '~/apis/mcp-admin.api';
import { ToastProvider } from '~/components/ui';
import { createTestQueryClient } from '~/test/test-utils';
import McpSetting from './mcp';

vi.mock('~/apis/mcp-admin.api', () => ({
    fetchMcpAdminStatus: vi.fn(),
    setMcpEnabled: vi.fn(),
    rotateMcpToken: vi.fn(),
    revokeMcpToken: vi.fn(),
}));

const createMcpStatus = (overrides: Partial<McpAdminStatus> = {}): McpAdminStatus => ({
    enabled: false,
    hasActiveToken: false,
    token: null,
    server: {
        version: '0.7.3',
        releaseUrl: 'https://github.com/baealex/ocean-brain/releases',
        mcpVersionRequirement: '0.7.x',
    },
    ...overrides,
});

const renderPage = () => {
    const queryClient = createTestQueryClient();

    render(
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <McpSetting />
            </ToastProvider>
        </QueryClientProvider>,
    );
};

describe('<McpSetting />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows origin-based MCP server URL and renders mcp.json snippet', async () => {
        vi.mocked(mcpAdminApi.fetchMcpAdminStatus).mockResolvedValue(createMcpStatus());

        renderPage();

        expect(await screen.findByText('v0.7.3')).toBeInTheDocument();
        expect(screen.getByText('0.7.x')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /check latest version/i })).toHaveAttribute(
            'href',
            'https://github.com/baealex/ocean-brain/releases',
        );
        expect(await screen.findByLabelText(/server url/i)).toHaveValue(window.location.origin);
        expect(screen.getAllByText(/"mcpServers"/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/--token-file/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/--token/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(new RegExp(window.location.origin)).length).toBeGreaterThan(0);
    });

    it('submits enabled toggle and refreshes status', async () => {
        vi.mocked(mcpAdminApi.fetchMcpAdminStatus).mockResolvedValue(createMcpStatus());
        vi.mocked(mcpAdminApi.setMcpEnabled).mockResolvedValue(createMcpStatus({ enabled: true }));

        renderPage();

        const toggle = await screen.findByRole('switch', { name: /allow mcp access/i });
        await userEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-checked', 'true');
    });
});
