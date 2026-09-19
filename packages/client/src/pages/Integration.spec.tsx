import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as appGatewayApi from '~/apis/app-gateway.api';
import * as api from '~/apis/integration.api';
import { createTestQueryClient } from '~/test/test-utils';
import IntegrationPage from './Integration';

vi.mock('~/apis/integration.api', () => ({ fetchIntegrations: vi.fn() }));
vi.mock('~/apis/app-gateway.api', () => ({ issueProxiedAppAccess: vi.fn() }));
const routerMocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    search: {} as { app?: string },
}));
vi.mock('@tanstack/react-router', () => ({
    useParams: () => ({ connectionId: 'inbox' }),
    useSearch: () => routerMocks.search,
    useNavigate: () => routerMocks.navigate,
    Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
const integration: api.IntegrationConnection = {
    id: 'inbox',
    native: false,
    enabled: true,
    pinned: true,
    proxyConfigured: false,
    grantedPermissions: ['notes:read'],
    token: null,
    createdAt: '',
    updatedAt: '',
    manifest: {
        schemaVersion: 1,
        apiVersion: 1,
        id: 'example.inbox',
        name: 'Inbox',
        description: 'An independent app.',
        version: '1',
        permissions: ['notes:read'],
        launch: { url: 'http://127.0.0.1:7777/', mode: 'iframe' },
    },
};
const renderPage = () =>
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <IntegrationPage />
        </QueryClientProvider>,
    );

beforeEach(() => {
    routerMocks.navigate.mockReset();
    routerMocks.search = {};
    vi.mocked(appGatewayApi.issueProxiedAppAccess).mockResolvedValue({
        connectionId: 'inbox',
        token: 'proxied-access-token',
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
    });
});

it('embeds an enabled integration in a sandbox with the app bridge', async () => {
    vi.mocked(api.fetchIntegrations).mockResolvedValue([integration]);
    renderPage();
    const frame = await screen.findByTitle('Inbox');
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-forms');
    expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(frame).toHaveAttribute('src', 'http://127.0.0.1:7777/');
    expect(screen.getByRole('link', { name: 'Open in a new tab' })).toHaveAttribute('rel', 'noopener noreferrer');
});

it('restores app state from the host URL and handles app navigation messages', async () => {
    routerMocks.search = { app: '/?query=whale&sort=updated&page=2' };
    vi.mocked(api.fetchIntegrations).mockResolvedValue([integration]);
    renderPage();
    const frame = await screen.findByTitle('Inbox');
    expect(frame).toHaveAttribute('src', 'http://127.0.0.1:7777/?query=whale&sort=updated&page=2');

    act(() => {
        window.dispatchEvent(
            new MessageEvent('message', {
                origin: 'null',
                source: frame.contentWindow,
                data: { type: 'ocean-brain:location-change', version: 1, location: '/?query=coral&page=1' },
            }),
        );
        window.dispatchEvent(
            new MessageEvent('message', {
                origin: 'null',
                source: frame.contentWindow,
                data: { type: 'ocean-brain:open-note', version: 1, noteId: '42' },
            }),
        );
    });

    expect(routerMocks.navigate).toHaveBeenCalledWith({
        to: '/integrations/$connectionId',
        params: { connectionId: 'inbox' },
        search: { app: '/?query=coral&page=1' },
    });
    expect(routerMocks.navigate).toHaveBeenCalledWith({ to: '/$id', params: { id: '42' } });
});

it('does not load a disabled integration page', async () => {
    vi.mocked(api.fetchIntegrations).mockResolvedValue([{ ...integration, enabled: false }]);
    renderPage();
    expect(await screen.findByText('App unavailable')).toBeInTheDocument();
    expect(screen.queryByTitle('Inbox')).not.toBeInTheDocument();
});

it('uses an external link instead of embedding the host origin', async () => {
    vi.mocked(api.fetchIntegrations).mockResolvedValue([
        {
            ...integration,
            manifest: { ...integration.manifest, launch: { url: window.location.origin, mode: 'iframe' } },
        },
    ]);
    renderPage();
    expect(await screen.findByText('Open this app in a new tab to use its service.')).toBeInTheDocument();
    expect(screen.queryByTitle('Inbox')).not.toBeInTheDocument();
});

it('opens a proxied integration through the Ocean Brain app gateway', async () => {
    vi.mocked(api.fetchIntegrations).mockResolvedValue([
        {
            ...integration,
            proxyConfigured: true,
            manifest: { ...integration.manifest, launch: { mode: 'proxied' } },
        },
    ]);
    renderPage();
    const frame = await screen.findByTitle('Inbox');
    expect(frame).toHaveAttribute('src', '/apps/inbox/');
    expect(frame).toHaveAttribute('sandbox', 'allow-downloads allow-forms allow-modals allow-scripts');
    expect(screen.queryByRole('link', { name: 'Open in a new tab' })).not.toBeInTheDocument();
});

it('asks for a private URL before opening an unconfigured proxied integration', async () => {
    vi.mocked(api.fetchIntegrations).mockResolvedValue([
        {
            ...integration,
            manifest: { ...integration.manifest, launch: { mode: 'proxied' } },
        },
    ]);
    renderPage();

    expect(await screen.findByText(/Configure this app's private URL/)).toBeInTheDocument();
    expect(screen.queryByTitle('Inbox')).not.toBeInTheDocument();
});
