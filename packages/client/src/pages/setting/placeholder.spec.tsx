import { QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';

import { fetchPlaceholders } from '~/apis/placeholder.api';
import { SETTINGS_PLACEHOLDER_ROUTE } from '~/modules/url';
import { createTestQueryClient } from '~/test/test-utils';
import Placeholder from './placeholder';

vi.mock('~/apis/placeholder.api', () => ({
    createPlaceholder: vi.fn(),
    deletePlaceholder: vi.fn(),
    fetchPlaceholders: vi.fn(),
}));

const renderPage = async () => {
    window.history.pushState({}, '', `${SETTINGS_PLACEHOLDER_ROUTE}?page=1`);

    const queryClient = createTestQueryClient();
    const rootRoute = createRootRoute({ component: () => <Placeholder /> });
    const route = createRoute({
        getParentRoute: () => rootRoute,
        path: SETTINGS_PLACEHOLDER_ROUTE,
        component: () => null,
    });
    const router = createRouter({ routeTree: rootRoute.addChildren([route]) });

    render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    );

    await act(async () => {
        await router.load();
    });
};

describe('<Placeholder />', () => {
    it('labels the icon-only custom placeholder delete button with target context', async () => {
        vi.mocked(fetchPlaceholders).mockResolvedValue({
            type: 'success',
            allPlaceholders: {
                totalCount: 1,
                placeholders: [
                    {
                        id: 1,
                        name: 'Project name',
                        template: 'project',
                        replacement: 'Ocean Brain',
                        createdAt: '2026-06-23T00:00:00.000Z',
                        updatedAt: '2026-06-23T00:00:00.000Z',
                    },
                ],
            },
        } as never);

        await renderPage();

        expect(await screen.findByRole('button', { name: 'Delete placeholder Project name' })).toBeInTheDocument();
    });
});
