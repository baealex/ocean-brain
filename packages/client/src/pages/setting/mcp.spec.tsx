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

        expect(await screen.findByLabelText(/server url/i)).toHaveValue(window.location.origin);
        expect(screen.getAllByText(/"mcpServers"/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/--token-file/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/--token/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(new RegExp(window.location.origin)).length).toBeGreaterThan(0);
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
