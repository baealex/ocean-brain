import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as integrations from '~/apis/integration.api';
import * as navigation from '~/apis/navigation-settings.api';
import { createTestQueryClient } from '~/test/test-utils';
import NavigationSettingsPage from './navigation';

vi.mock('~/apis/integration.api', () => ({ fetchIntegrations: vi.fn() }));
vi.mock('~/apis/navigation-settings.api', () => ({
    fetchNavigationSettings: vi.fn(),
    saveNavigationSettings: vi.fn(),
}));

const empty: navigation.NavigationSettings = { preferences: null, revision: null, status: 'ready' };
const app: integrations.IntegrationConnection = {
    id: 'inbox',
    native: false,
    enabled: true,
    pinned: true,
    proxyConfigured: false,
    token: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    grantedPermissions: [],
    manifest: {
        schemaVersion: 1,
        apiVersion: 1,
        id: 'example.inbox',
        name: 'Inbox',
        description: 'Example app',
        version: '1.0.0',
        permissions: [],
        launch: { mode: 'iframe', url: 'https://example.com' },
    },
};
const renderPage = () =>
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <NavigationSettingsPage />
        </QueryClientProvider>,
    );

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(navigation.fetchNavigationSettings).mockResolvedValue(empty);
    vi.mocked(integrations.fetchIntegrations).mockResolvedValue([app]);
    vi.mocked(navigation.saveNavigationSettings).mockResolvedValue(empty);
});

it('edits menu visibility in a draft, saves shared pins, and keeps Settings visible', async () => {
    const user = userEvent.setup();
    renderPage();
    const graph = await screen.findByRole('switch', { name: 'Show Graph in top bar' });
    expect(screen.getByRole('switch', { name: 'Show Setting in top bar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await user.click(graph);
    await user.click(screen.getByRole('switch', { name: 'Show Inbox in top bar' }));
    expect(within(screen.getByRole('region', { name: 'Menu preview' })).queryByText('Graph')).not.toBeInTheDocument();
    expect(navigation.saveNavigationSettings).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
        expect(navigation.saveNavigationSettings).toHaveBeenCalledWith(
            {
                expectedRevision: null,
                preferences: {
                    schemaVersion: 1,
                    order: [
                        'core:search',
                        'core:notes',
                        'core:views',
                        'core:graph',
                        'core:calendar',
                        'core:reminders',
                        'core:tags',
                        'core:settings',
                        'integration:inbox',
                    ],
                    hiddenCoreIds: ['core:graph'],
                },
                pins: [{ id: 'inbox', pinned: false, expectedUpdatedAt: app.updatedAt }],
            },
            expect.anything(),
        ),
    );
});

it('cancels drafts and resets persisted overrides by deleting the saved preference', async () => {
    const saved: navigation.NavigationSettings = {
        revision: 'saved',
        status: 'ready',
        preferences: {
            schemaVersion: 1,
            order: ['integration:inbox', 'core:notes'],
            hiddenCoreIds: ['core:graph'],
        },
    };
    vi.mocked(navigation.fetchNavigationSettings).mockResolvedValue(saved);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('switch', { name: 'Show Graph in top bar' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('switch', { name: 'Show Graph in top bar' })).not.toBeChecked();
    expect(navigation.saveNavigationSettings).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Reset menu layout' }));
    await waitFor(() =>
        expect(navigation.saveNavigationSettings).toHaveBeenCalledWith(
            { expectedRevision: 'saved', preferences: null },
            expect.anything(),
        ),
    );
});

it('preserves the draft on a failed save and allows reloading current settings', async () => {
    vi.mocked(navigation.saveNavigationSettings).mockRejectedValue(
        new Error('Menu settings changed. Reload before saving.'),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('switch', { name: 'Show Graph in top bar' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Menu settings changed');
    expect(screen.getByRole('switch', { name: 'Show Graph in top bar' })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Reload saved settings' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Show Graph in top bar' })).toBeChecked());
});
