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
        mcpVersionRequirement: '0.9.x',
        mcp: {
            compatibilityVersion: '0.9.0',
            compatibilityRequirement: '0.9.x',
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
                    mcpVersionRequirement: '0.9.x',
                    mcp: {
                        compatibilityVersion: '0.9.0',
                        compatibilityRequirement: '0.9.x',
                        compatibilityVersionHeader: 'X-Ocean-Brain-MCP-Compatibility-Version',
                        clientVersionHeader: 'X-Ocean-Brain-MCP-Client-Version',
                    },
                },
            }),
        );

        renderPage();

        expect(await screen.findByText('MCP compatibility 0.9.x')).toBeInTheDocument();
    });

    it('uses the built-in ocean-brain MCP command for every client guide', async () => {
        vi.mocked(mcpAdminApi.fetchMcpAdminStatus).mockResolvedValue(createMcpStatus());

        renderPage();

        expect(((await screen.findByLabelText('Codex setup')) as HTMLTextAreaElement).value).toContain(
            'npx -y ocean-brain mcp',
        );

        await userEvent.click(screen.getByRole('radio', { name: 'Claude' }));
        expect((screen.getByLabelText('Claude setup') as HTMLTextAreaElement).value).toContain(
            'npx -y ocean-brain mcp',
        );

        await userEvent.click(screen.getByRole('radio', { name: 'JSON' }));
        const jsonSetup = screen.getByLabelText('Token file and MCP JSON') as HTMLTextAreaElement;

        expect(jsonSetup.value).toContain('"command": "npx"');
        expect(jsonSetup.value).toContain('"ocean-brain",');
        expect(jsonSetup.value).toContain('"mcp",');
    });

    it('generates a PowerShell setup for Windows clients', async () => {
        vi.mocked(mcpAdminApi.fetchMcpAdminStatus).mockResolvedValue(createMcpStatus());

        renderPage();

        await userEvent.click(await screen.findByText('Connection options'));
        await userEvent.click(screen.getByRole('radio', { name: 'Windows PowerShell' }));

        const setup = screen.getByLabelText('Codex setup') as HTMLTextAreaElement;
        expect(setup.value).toContain('New-Item -ItemType Directory -Force');
        expect(setup.value).toContain("--token-file '$HOME\\.config\\ocean-brain\\mcp-token'");
        expect(setup.value).toContain('codex mcp add ocean-brain -- cmd.exe /d /c npx -y ocean-brain mcp');

        await userEvent.click(screen.getByRole('radio', { name: 'JSON' }));
        const jsonSetup = screen.getByLabelText('Token file and MCP JSON') as HTMLTextAreaElement;
        expect(jsonSetup.value).toContain('"command": "cmd.exe"');
        expect(jsonSetup.value).toContain('"/c",');
        expect(jsonSetup.value).toContain('"npx",');
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
