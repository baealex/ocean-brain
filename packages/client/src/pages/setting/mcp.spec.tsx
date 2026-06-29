import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { McpAdminStatus } from '~/apis/mcp-admin.api';
import * as mcpAdminApi from '~/apis/mcp-admin.api';
import { ConfirmProvider, ToastProvider } from '~/components/ui';
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
    const queryClient = createTestQueryClient();

    render(
        <QueryClientProvider client={queryClient}>
            <ConfirmProvider>
                <ToastProvider>
                    <McpSetting />
                </ToastProvider>
            </ConfirmProvider>
        </QueryClientProvider>,
    );
};

describe('<McpSetting />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows origin-based Ocean Brain URL', async () => {
        vi.mocked(mcpAdminApi.fetchMcpAdminStatus).mockResolvedValue(createMcpStatus());

        renderPage();

        expect(await screen.findByLabelText(/ocean brain url/i)).toHaveValue(window.location.origin);
    });

    it('uses server MCP compatibility requirement instead of app version for CLI guidance', async () => {
        vi.mocked(mcpAdminApi.fetchMcpAdminStatus).mockResolvedValue(
            createMcpStatus({
                server: {
                    version: '0.8.0',
                    releaseUrl: 'https://github.com/baealex/ocean-brain/releases',
                    mcpVersionRequirement: '0.7.x',
                    mcp: {
                        compatibilityVersion: '0.7.0',
                        compatibilityRequirement: '0.7.x',
                        compatibilityVersionHeader: 'X-Ocean-Brain-MCP-Compatibility-Version',
                        clientVersionHeader: 'X-Ocean-Brain-MCP-Client-Version',
                    },
                },
            }),
        );

        renderPage();

        expect(await screen.findByText('MCP compatibility 0.7.x')).toBeInTheDocument();
    });

    it('submits enabled toggle and refreshes status', async () => {
        vi.mocked(mcpAdminApi.fetchMcpAdminStatus).mockResolvedValue(createMcpStatus());
        vi.mocked(mcpAdminApi.setMcpEnabled).mockResolvedValue(createMcpStatus({ enabled: true }));

        renderPage();

        const toggle = await screen.findByRole('switch', { name: /mcp access/i });
        await userEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-checked', 'true');
    });
});
