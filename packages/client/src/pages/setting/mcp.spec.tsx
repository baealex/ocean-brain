import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';

import { createTestQueryClient } from '~/test/test-utils';
import { ToastProvider } from '~/components/ui';
import * as mcpAdminApi from '~/apis/mcp-admin.api';
import McpSetting from './mcp';

vi.mock('~/apis/mcp-admin.api', () => ({
    fetchMcpAdminStatus: vi.fn(),
    setMcpEnabled: vi.fn(),
    rotateMcpToken: vi.fn(),
    revokeMcpToken: vi.fn()
}));

const renderPage = () => {
    const queryClient = createTestQueryClient();

    render(
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <McpSetting />
            </ToastProvider>
        </QueryClientProvider>
    );
};

describe('<McpSetting />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows origin-based MCP server URL and renders mcp.json snippet', async () => {
        vi.mocked(mcpAdminApi.fetchMcpAdminStatus).mockResolvedValue({
            enabled: false,
            hasActiveToken: false,
            token: null
        });

        renderPage();

        expect(await screen.findByLabelText('MCP Server URL')).toHaveValue(window.location.origin);
        expect(screen.getAllByText(/"mcpServers"/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/--token-file/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/--token/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(new RegExp(window.location.origin)).length).toBeGreaterThan(0);
    });

    it('warns that rotate invalidates previous token immediately', async () => {
        vi.mocked(mcpAdminApi.fetchMcpAdminStatus).mockResolvedValue({
            enabled: true,
            hasActiveToken: true,
            token: {
                id: '1',
                createdAt: '2026-04-04T00:00:00.000Z',
                lastUsedAt: null
            }
        });
        vi.mocked(mcpAdminApi.rotateMcpToken).mockResolvedValue({ token: 'new-plaintext-token' });

        renderPage();

        await userEvent.click(await screen.findByRole('button', { name: 'Rotate token' }));

        expect(await screen.findByText(/invalidates previous token immediately/i)).toBeInTheDocument();
        expect(await screen.findByDisplayValue('new-plaintext-token')).toBeInTheDocument();
    });

    it('submits enabled toggle and refreshes status', async () => {
        vi.mocked(mcpAdminApi.fetchMcpAdminStatus).mockResolvedValue({
            enabled: false,
            hasActiveToken: false,
            token: null
        });
        vi.mocked(mcpAdminApi.setMcpEnabled).mockResolvedValue({
            enabled: true,
            hasActiveToken: false,
            token: null
        });

        renderPage();

        const toggle = await screen.findByRole('switch', { name: /allow mcp access/i });
        await userEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-checked', 'true');
    });
});
