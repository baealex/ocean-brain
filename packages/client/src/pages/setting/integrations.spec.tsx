import { QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as api from '~/apis/integration.api';
import { ConfirmProvider } from '~/components/ui';
import { validateIntegrationsSearch } from '~/modules/route-search';
import { SETTINGS_INTEGRATIONS_ROUTE } from '~/modules/url';
import { createTestQueryClient } from '~/test/test-utils';
import IntegrationsSettings from './integrations';

vi.mock('~/apis/integration.api', async (original) => ({
    ...(await original<typeof api>()),
    fetchIntegrations: vi.fn(),
    connectIntegration: vi.fn(),
    updateIntegration: vi.fn(),
    rotateIntegrationToken: vi.fn(),
}));

beforeAll(() => {
    Object.defineProperties(HTMLElement.prototype, {
        hasPointerCapture: { configurable: true, value: () => false },
        setPointerCapture: { configurable: true, value: () => undefined },
        releasePointerCapture: { configurable: true, value: () => undefined },
        scrollIntoView: { configurable: true, value: () => undefined },
    });
});

const manifest: api.IntegrationManifest = {
    schemaVersion: 1,
    apiVersion: 1,
    id: 'example.inbox',
    name: 'Inbox',
    version: '1.0.0',
    description: 'Read and create notes.',
    permissions: ['notes:read', 'notes:create'],
    launch: { url: 'http://127.0.0.1:7777/', mode: 'iframe' },
};
const connected: api.IntegrationConnection = {
    id: 'inbox',
    native: false,
    manifest,
    proxyConfigured: false,
    enabled: false,
    pinned: false,
    grantedPermissions: ['notes:read'],
    token: null,
    createdAt: '2026-09-17T00:00:00Z',
    updatedAt: '2026-09-17T00:00:00Z',
};
const renderPage = async (search = '') => {
    const root = createRootRoute();
    const route = createRoute({
        getParentRoute: () => root,
        path: SETTINGS_INTEGRATIONS_ROUTE,
        validateSearch: validateIntegrationsSearch,
        component: IntegrationsSettings,
    });
    const router = createRouter({
        routeTree: root.addChildren([route]),
        history: createMemoryHistory({ initialEntries: [SETTINGS_INTEGRATIONS_ROUTE + search] }),
    });
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <ConfirmProvider>
                <RouterProvider router={router} />
            </ConfirmProvider>
        </QueryClientProvider>,
    );
    await act(async () => router.load());
    return router;
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchIntegrations).mockResolvedValue([]);
});

it('requires explicit grants when registering a manifest and groups write access with read', async () => {
    vi.mocked(api.connectIntegration).mockResolvedValue(connected);
    const user = userEvent.setup();
    const router = await renderPage();
    await user.click(screen.getByRole('button', { name: 'Connect app' }));
    await user.click(screen.getByText('Paste manifest JSON'));
    await user.click(screen.getByLabelText('App manifest JSON'));
    await user.paste(JSON.stringify(manifest));
    expect(screen.getByLabelText('Read notes')).not.toBeChecked();
    expect(screen.getByLabelText('Create notes')).not.toBeChecked();
    await user.click(screen.getByLabelText('Create notes'));
    expect(screen.getByLabelText('Read notes')).toBeChecked();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Connect app' }));
    await waitFor(() =>
        expect(api.connectIntegration).toHaveBeenCalledWith({
            manifest,
            grantedPermissions: ['notes:read', 'notes:create'],
        }),
    );
    await waitFor(() => expect(router.state.location.search).toEqual({ connection: 'inbox' }));
});

it('loads a manifest through the native file input', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: 'Connect app' }));

    const fileInput = screen.getByLabelText('App manifest file');
    expect(fileInput.parentElement).toHaveTextContent('Choose file');
    await user.upload(fileInput, new File([JSON.stringify(manifest)], 'manifest.json', { type: 'application/json' }));

    const dialog = within(screen.getByRole('dialog'));
    expect(await dialog.findByText('Inbox')).toBeVisible();
    expect(dialog.getByText('manifest.json')).toBeVisible();
    expect(dialog.getByRole('button', { name: 'Connect app' })).toBeEnabled();
});

it('manages connection activation, navigation and one-time credentials', async () => {
    vi.mocked(api.fetchIntegrations).mockResolvedValue([connected]);
    vi.mocked(api.updateIntegration).mockResolvedValue(connected);
    vi.mocked(api.rotateIntegrationToken).mockResolvedValue({ token: 'one-time-test-token' });
    const user = userEvent.setup();
    const router = await renderPage();
    await user.click(await screen.findByRole('switch', { name: 'Enable Inbox' }));
    await waitFor(() => expect(api.updateIntegration).toHaveBeenCalledWith({ id: 'inbox', enabled: true }));
    expect(screen.queryByRole('button', { name: 'Generate token' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Configure Inbox' }));
    expect(router.state.location.search).toEqual({ connection: 'inbox' });
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Show in top bar' })).toBeEnabled());
    await user.click(screen.getByRole('switch', { name: 'Show in top bar' }));
    await waitFor(() => expect(api.updateIntegration).toHaveBeenCalledWith({ id: 'inbox', pinned: true }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Generate token' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Generate token' }));
    expect(await screen.findByLabelText('Save this token now. It is shown only once.')).toHaveValue(
        'one-time-test-token',
    );
    await user.click(screen.getByRole('button', { name: 'Hide token' }));
    expect(screen.queryByDisplayValue('one-time-test-token')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Configure Inbox' }));
    expect(screen.getByRole('button', { name: 'Configure Inbox' })).toHaveAttribute('aria-expanded', 'false');
    expect(router.state.location.search).toEqual({});
});

it('prefills manifest settings and changes an app to proxied mode with a private URL', async () => {
    const updated = {
        ...connected,
        proxyConfigured: true,
        manifest: { ...connected.manifest, name: 'Proxied Inbox', launch: { mode: 'proxied' as const } },
    };
    vi.mocked(api.fetchIntegrations).mockResolvedValue([connected]);
    vi.mocked(api.updateIntegration).mockResolvedValue(updated);
    const user = userEvent.setup();
    await renderPage();

    await user.click(await screen.findByRole('button', { name: 'Configure Inbox' }));
    await user.click(screen.getByText('Update app manifest'));

    expect(screen.getByLabelText('App name')).toHaveValue('Inbox');
    expect(screen.getByLabelText('Description')).toHaveValue('Read and create notes.');
    expect(screen.getByLabelText('Version')).toHaveValue('1.0.0');
    expect(screen.getByLabelText('Updated manifest for Inbox')).toHaveValue(
        JSON.stringify(connected.manifest, null, 2),
    );

    await user.clear(screen.getByLabelText('App name'));
    await user.type(screen.getByLabelText('App name'), 'Proxied Inbox');
    await user.click(screen.getByRole('combobox', { name: 'App page' }));
    await user.click(await screen.findByRole('option', { name: 'Proxied through Ocean Brain' }));
    await user.type(screen.getByLabelText('Private app URL'), 'http://127.0.0.1:7778');
    await user.click(screen.getByRole('button', { name: 'Update manifest' }));

    await waitFor(() =>
        expect(api.updateIntegration).toHaveBeenCalledWith({
            id: 'inbox',
            manifest: updated.manifest,
            proxyUrl: 'http://127.0.0.1:7778',
        }),
    );
});

it('requires a private URL when connecting a proxied app', async () => {
    const proxiedManifest: api.IntegrationManifest = { ...manifest, launch: { mode: 'proxied' } };
    vi.mocked(api.connectIntegration).mockResolvedValue({
        ...connected,
        manifest: proxiedManifest,
        proxyConfigured: true,
    });
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: 'Connect app' }));
    await user.click(screen.getByText('Paste manifest JSON'));
    await user.click(screen.getByLabelText('App manifest JSON'));
    await user.paste(JSON.stringify(proxiedManifest));

    const connectButton = within(screen.getByRole('dialog')).getByRole('button', { name: 'Connect app' });
    expect(connectButton).toBeDisabled();
    await user.type(screen.getByLabelText('Private app URL'), 'http://elastic-search:7778');
    expect(connectButton).toBeEnabled();
    await user.click(connectButton);

    await waitFor(() =>
        expect(api.connectIntegration).toHaveBeenCalledWith({
            manifest: proxiedManifest,
            grantedPermissions: [],
            proxyUrl: 'http://elastic-search:7778',
        }),
    );
});

it('opens the connection selected by a direct settings URL', async () => {
    vi.mocked(api.fetchIntegrations).mockResolvedValue([connected]);
    await renderPage('?connection=inbox');
    expect(await screen.findByRole('button', { name: 'Configure Inbox' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Generate token' })).toBeVisible();
});
