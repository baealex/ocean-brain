import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as api from '~/apis/integration.api';
import { createTestQueryClient } from '~/test/test-utils';
import IntegrationPage from './Integration';

vi.mock('~/apis/integration.api', () => ({ fetchIntegrations: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({
    useParams: () => ({ connectionId: 'inbox' }),
    Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
const integration: api.IntegrationConnection = {
    id: 'inbox',
    native: false,
    enabled: true,
    pinned: true,
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

it('embeds only an enabled integration without sharing origin or session capabilities', async () => {
    vi.mocked(api.fetchIntegrations).mockResolvedValue([integration]);
    renderPage();
    const frame = await screen.findByTitle('Inbox');
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-forms');
    expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(frame).toHaveAttribute('src', 'http://127.0.0.1:7777/');
    expect(screen.getByRole('link', { name: 'Open in a new tab' })).toHaveAttribute('rel', 'noopener noreferrer');
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
