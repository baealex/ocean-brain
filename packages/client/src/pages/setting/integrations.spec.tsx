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
import { ConfirmProvider, ToastProvider } from '~/components/ui';
import { validateIntegrationSettingsSearch, validateIntegrationsSearch } from '~/modules/route-search';
import {
    SETTINGS_INTEGRATION_CONNECT_ROUTE,
    SETTINGS_INTEGRATION_DETAIL_ROUTE,
    SETTINGS_INTEGRATIONS_ROUTE,
    SETTINGS_MCP_ROUTE,
} from '~/modules/url';
import { createTestQueryClient } from '~/test/test-utils';
import IntegrationConnect from './integration-connect';
import IntegrationDetail from './integration-detail';
import IntegrationsSettings from './integrations';

vi.mock('~/apis/integration.api', async (original) => ({
    ...(await original<typeof api>()),
    fetchIntegrations: vi.fn(),
    connectIntegration: vi.fn(),
    updateIntegration: vi.fn(),
    rotateIntegrationToken: vi.fn(),
    revokeIntegrationToken: vi.fn(),
    disconnectIntegration: vi.fn(),
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
const registered: api.IntegrationConnection = {
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
const tokenMetadata = { id: 'token', createdAt: registered.createdAt, lastUsedAt: null };
const connected: api.IntegrationConnection = { ...registered, enabled: true, token: tokenMetadata };
const detailUrl = '/setting/integrations/inbox';
let connections: api.IntegrationConnection[];

const renderPage = async (path = SETTINGS_INTEGRATIONS_ROUTE) => {
    const root = createRootRoute();
    const list = createRoute({
        getParentRoute: () => root,
        path: SETTINGS_INTEGRATIONS_ROUTE,
        validateSearch: validateIntegrationsSearch,
        component: IntegrationsSettings,
    });
    const connect = createRoute({
        getParentRoute: () => root,
        path: SETTINGS_INTEGRATION_CONNECT_ROUTE,
        component: IntegrationConnect,
    });
    const detail = createRoute({
        getParentRoute: () => root,
        path: SETTINGS_INTEGRATION_DETAIL_ROUTE,
        validateSearch: validateIntegrationSettingsSearch,
        component: IntegrationDetail,
    });
    const mcp = createRoute({
        getParentRoute: () => root,
        path: SETTINGS_MCP_ROUTE,
        component: () => <h1>AI client setup</h1>,
    });
    const router = createRouter({
        routeTree: root.addChildren([list, connect, detail, mcp]),
        history: createMemoryHistory({ initialEntries: [path] }),
    });
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <ConfirmProvider>
                <ToastProvider>
                    <RouterProvider router={router} />
                </ToastProvider>
            </ConfirmProvider>
        </QueryClientProvider>,
    );
    await act(async () => router.load());
    return router;
};

beforeEach(() => {
    vi.resetAllMocks();
    connections = [connected];
    vi.mocked(api.fetchIntegrations).mockImplementation(async () => connections);
    vi.mocked(api.connectIntegration).mockImplementation(async (input) => {
        const connection = {
            ...registered,
            manifest: input.manifest as api.IntegrationManifest,
            grantedPermissions: input.grantedPermissions,
            proxyConfigured: Boolean(input.proxyUrl),
        };
        connections = [connection];
        return connection;
    });
    vi.mocked(api.updateIntegration).mockImplementation(async ({ id, ...input }) => {
        const previous = connections.find((item) => item.id === id)!;
        const updated = {
            ...previous,
            ...input,
            manifest: (input.manifest as api.IntegrationManifest) ?? previous.manifest,
            proxyConfigured: Boolean(input.proxyUrl) || previous.proxyConfigured,
        };
        connections = connections.map((item) => (item.id === id ? updated : item));
        return updated;
    });
    vi.mocked(api.rotateIntegrationToken).mockImplementation(async (id) => {
        connections = connections.map((item) => (item.id === id ? { ...item, token: tokenMetadata } : item));
        return { token: 'one-time-test-token' };
    });
});

it('keeps MCP discoverable without presenting it as an unfinished setup task', async () => {
    connections = [{ ...registered, id: 'mcp', native: true, manifest: { ...manifest, name: 'MCP' } }];
    const user = userEvent.setup();
    const router = await renderPage();
    expect(await screen.findByRole('region', { name: 'MCP' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Connect AI client' })).toHaveAttribute('href', SETTINGS_MCP_ROUTE);
    expect(screen.queryByText('Setup needed')).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Connect app' }));
    expect(router.state.location.pathname).toBe(SETTINGS_INTEGRATION_CONNECT_ROUTE);
    await user.click(screen.getByRole('link', { name: /AI client/ }));
    expect(await screen.findByRole('heading', { name: 'AI client setup' })).toBeVisible();
    expect(router.state.location.pathname).toBe(SETTINGS_MCP_ROUTE);
});

it('opens actual settings pages, separates access and advanced editing, and supports history', async () => {
    const user = userEvent.setup();
    const router = await renderPage();
    const settings = await screen.findByRole('link', { name: 'Settings' });
    expect(settings).toHaveAttribute('href', detailUrl);
    await user.click(settings);
    expect(await screen.findByRole('switch', { name: 'Enable Inbox' })).toBeChecked();
    expect(router.state.location.pathname).toBe(detailUrl);
    expect(screen.queryByLabelText('Read notes')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('App name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace token' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Access', exact: true }));
    expect(await screen.findByLabelText('Read notes')).toBeChecked();
    expect(router.state.location.search).toEqual({ section: 'access' });
    expect(
        within(screen.getByRole('navigation', { name: 'Connection settings' })).getAllByRole('link', {
            current: 'page',
        }),
    ).toHaveLength(1);
    expect(screen.queryByLabelText('App name')).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Advanced', exact: true }));
    expect(await screen.findByLabelText('App name')).toHaveValue('Inbox');
    expect(screen.queryByLabelText('Read notes')).not.toBeInTheDocument();
    await act(async () => router.history.back());
    expect(await screen.findByLabelText('Read notes')).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Integrations', exact: true }));
    expect(await screen.findByRole('heading', { name: 'Integrations', exact: true })).toBeVisible();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
});

it('connects from a native file input with explicit grants and preserves the token until setup finishes', async () => {
    connections = [];
    const user = userEvent.setup();
    const router = await renderPage(SETTINGS_INTEGRATION_CONNECT_ROUTE);
    await user.click(screen.getByRole('button', { name: /External app/ }));
    await user.upload(
        screen.getByLabelText('App manifest file'),
        new File([JSON.stringify(manifest)], 'manifest.json', { type: 'application/json' }),
    );
    expect(await screen.findByText('Inbox')).toBeVisible();
    expect(screen.queryByLabelText('Read notes')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Read notes')).not.toBeChecked();
    expect(screen.getByLabelText('Create notes')).not.toBeChecked();
    await user.click(screen.getByLabelText('Create notes'));
    expect(screen.getByLabelText('Read notes')).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Connect app', exact: true }));
    expect(await screen.findByRole('button', { name: 'Enable connection' })).toBeDisabled();
    expect(api.connectIntegration).toHaveBeenCalledWith({
        manifest,
        grantedPermissions: ['notes:read', 'notes:create'],
    });
    expect(screen.queryByLabelText('Read notes')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Generate token' }));
    expect(await screen.findByLabelText('Save this token now. It is shown only once.')).toHaveValue(
        'one-time-test-token',
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enable connection' })).toBeEnabled());
    expect(router.state.location.search).toEqual({ setup: true });
    await user.click(screen.getByRole('button', { name: 'Enable connection' }));
    expect(await screen.findByRole('switch', { name: 'Enable Inbox' })).toBeChecked();
    expect(router.state.location.search).toEqual({});
    expect(screen.queryByDisplayValue('one-time-test-token')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open app' })).toBeVisible();
});

it('requires an app address when connecting a proxied manifest', async () => {
    const proxied = { ...manifest, launch: { mode: 'proxied' as const } };
    const user = userEvent.setup();
    await renderPage(SETTINGS_INTEGRATION_CONNECT_ROUTE);
    await user.click(screen.getByRole('button', { name: /External app/ }));
    await user.click(screen.getByRole('button', { name: 'Paste manifest JSON' }));
    await user.click(screen.getByLabelText('App manifest JSON'));
    await user.paste(JSON.stringify(proxied));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('button', { name: 'Connect app', exact: true })).toBeDisabled();
    await user.click(screen.getByLabelText('Read notes'));
    await user.type(screen.getByLabelText('Private app URL'), 'http://elastic-search:7778');
    await user.click(screen.getByRole('button', { name: 'Connect app', exact: true }));
    await waitFor(() =>
        expect(api.connectIntegration).toHaveBeenCalledWith({
            manifest: proxied,
            grantedPermissions: ['notes:read'],
            proxyUrl: 'http://elastic-search:7778',
        }),
    );
});

it('changes an app to proxied mode from its advanced page', async () => {
    const user = userEvent.setup();
    await renderPage(`${detailUrl}?section=advanced`);
    expect(await screen.findByLabelText('App name')).toHaveValue('Inbox');
    expect(screen.getByLabelText('Description')).toHaveValue(manifest.description);
    await user.clear(screen.getByLabelText('App name'));
    await user.type(screen.getByLabelText('App name'), 'Proxied Inbox');
    await user.click(screen.getByRole('combobox', { name: 'App page' }));
    await user.click(await screen.findByRole('option', { name: 'Proxied through Ocean Brain' }));
    await user.type(screen.getByLabelText('Private app URL'), 'http://127.0.0.1:7778');
    await user.click(screen.getByRole('button', { name: 'Update manifest' }));
    await waitFor(() =>
        expect(api.updateIntegration).toHaveBeenCalledWith({
            id: 'inbox',
            manifest: { ...manifest, name: 'Proxied Inbox', launch: { mode: 'proxied' } },
            proxyUrl: 'http://127.0.0.1:7778',
        }),
    );
});

it('saves permission changes explicitly and preserves a failed draft for retry', async () => {
    const user = userEvent.setup();
    await renderPage(`${detailUrl}?section=access`);
    expect(await screen.findByRole('button', { name: 'Save access' })).toBeDisabled();
    await user.click(screen.getByLabelText('Create notes'));
    expect(api.updateIntegration).not.toHaveBeenCalled();
    vi.mocked(api.updateIntegration).mockRejectedValueOnce(new Error('Could not save permissions.'));
    await user.click(screen.getByRole('button', { name: 'Save access' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save permissions.');
    expect(screen.getByLabelText('Create notes')).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save access' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save access' })).toBeDisabled());
    expect(api.updateIntegration).toHaveBeenLastCalledWith({
        id: 'inbox',
        grantedPermissions: ['notes:read', 'notes:create'],
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('confirms token replacement and hides the one-time credential on request', async () => {
    const user = userEvent.setup();
    await renderPage(`${detailUrl}?section=access`);
    await user.click(await screen.findByRole('button', { name: 'Replace token' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Existing connections using it will stop working.');
    expect(api.rotateIntegrationToken).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'OK' }));
    expect(await screen.findByLabelText('Save this token now. It is shown only once.')).toHaveValue(
        'one-time-test-token',
    );
    await user.click(screen.getByRole('button', { name: 'Hide token' }));
    expect(screen.queryByDisplayValue('one-time-test-token')).not.toBeInTheDocument();
});

it('refreshes app-reported failures and retains the last report if refresh fails', async () => {
    const user = userEvent.setup();
    await renderPage(detailUrl);
    expect(await screen.findByText('Waiting for app')).toBeVisible();
    connections = [
        {
            ...connected,
            statusReport: {
                state: 'failed',
                message: 'Reconnect your publishing account in the app.',
                reportedAt: new Date().toISOString(),
            },
        },
    ];
    await user.click(screen.getByRole('button', { name: 'Refresh status' }));
    expect(await screen.findByText('Needs attention')).toBeVisible();
    expect(screen.getByText('Reconnect your publishing account in the app.')).toBeVisible();
    vi.mocked(api.fetchIntegrations).mockRejectedValue(new Error('Network unavailable'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh status' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Refresh status' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Status may be out of date.');
    expect(screen.getByText('Needs attention')).toBeVisible();
});

it('keeps settings available for incomplete connections and only opens setup when requested', async () => {
    connections = [{ ...registered, manifest: { ...manifest, launch: { mode: 'proxied' } } }];
    const user = userEvent.setup();
    await renderPage();
    await user.click(await screen.findByRole('link', { name: 'Settings' }));
    expect(await screen.findByRole('link', { name: 'Continue connection' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Disconnect app' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Private app URL')).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Continue connection' }));
    expect(await screen.findByLabelText('Private app URL')).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Generate token' })).not.toBeInTheDocument();
});

it('enables apps with no note permissions without issuing a token', async () => {
    connections = [{ ...registered, manifest: { ...manifest, permissions: [] }, grantedPermissions: [] }];
    const user = userEvent.setup();
    await renderPage(`${detailUrl}?setup=true`);
    await user.click(await screen.findByRole('button', { name: 'Enable connection' }));
    expect(await screen.findByRole('link', { name: 'Open app' })).toBeVisible();
    expect(api.rotateIntegrationToken).not.toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Enable Inbox' })).toBeChecked();
});

it('shows overdue progress without claiming the app is offline', async () => {
    connections = [
        {
            ...connected,
            statusReport: { state: 'running', message: 'Indexing notes', reportedAt: registered.createdAt },
        },
    ];
    await renderPage();
    expect(await screen.findByText('Progress update overdue')).toBeVisible();
    expect(screen.getByText('Check the app before retrying.')).toBeVisible();
});

it('offers the MCP first task separately from settings and respects read-only access', async () => {
    connections = [
        { ...connected, id: 'mcp', native: true, manifest: { ...manifest, name: 'MCP', launch: undefined } },
    ];
    const user = userEvent.setup();
    await renderPage('/setting/integrations/mcp');
    expect(await screen.findByRole('link', { name: 'Client setup' })).toBeVisible();
    expect(screen.queryByLabelText('What would you like to research?')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try with your notes' }));
    await user.type(screen.getByLabelText('What would you like to research?'), 'Project decisions');
    await user.click(screen.getByText('Preview request'));
    expect(screen.getByLabelText<HTMLTextAreaElement>('Research request').value).toContain(
        'without changing any notes',
    );
    await user.click(screen.getByRole('button', { name: 'Copy research request' }));
    expect(await navigator.clipboard.readText()).toContain('Project decisions');
});

it('offers a return path when a saved settings URL no longer exists', async () => {
    connections = [];
    await renderPage(detailUrl);
    expect(await screen.findByText('This integration was disconnected or does not exist.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Integrations' })).toHaveAttribute('href', SETTINGS_INTEGRATIONS_ROUTE);
});

it('keeps the last task result separate from a disabled connection', async () => {
    connections = [
        {
            ...connected,
            enabled: false,
            statusReport: {
                state: 'succeeded',
                message: 'Notes are ready to search.',
                reportedAt: new Date().toISOString(),
            },
        },
    ];
    await renderPage(detailUrl);
    const activity = within(await screen.findByRole('region', { name: 'Activity', exact: true }));
    expect(activity.getByText('Completed', { exact: true })).toBeVisible();
    expect(activity.getByText('Reported by app')).toBeVisible();
    expect(activity.getByText('Notes are ready to search.')).toBeVisible();
    expect(screen.getByRole('switch', { name: 'Enable Inbox' })).not.toBeChecked();
});

it('disconnects from advanced management only after confirmation', async () => {
    vi.mocked(api.disconnectIntegration).mockImplementation(async () => {
        connections = [];
    });
    const user = userEvent.setup();
    const router = await renderPage(detailUrl);
    await user.click(await screen.findByRole('link', { name: 'Advanced', exact: true }));
    await user.click(screen.getByRole('button', { name: 'Disconnect app' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Notes will remain in Ocean Brain.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(api.disconnectIntegration).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Disconnect app' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(SETTINGS_INTEGRATIONS_ROUTE));
    expect(api.disconnectIntegration).toHaveBeenCalledWith('inbox');
    expect(await screen.findByText('No apps connected')).toBeVisible();
});
