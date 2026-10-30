import { QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { deletePlaceholder, fetchPlaceholders } from '~/apis/placeholder.api';
import { SETTINGS_PLACEHOLDER_ROUTE } from '~/modules/url';
import { createTestQueryClient } from '~/test/test-utils';
import Placeholder from './placeholder';

const mockConfirm = vi.fn();

vi.mock('~/apis/placeholder.api', () => ({
    createPlaceholder: vi.fn(),
    deletePlaceholder: vi.fn(),
    fetchPlaceholders: vi.fn(),
}));

vi.mock('~/components/ui', async () => {
    const actual = await vi.importActual<object>('~/components/ui');
    return {
        ...actual,
        useConfirm: () => mockConfirm,
    };
});

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
    beforeEach(() => {
        vi.clearAllMocks();
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
    });

    it('labels the icon-only custom placeholder delete button with target context', async () => {
        await renderPage();

        expect(await screen.findByRole('button', { name: 'Delete placeholder Project name' })).toBeInTheDocument();
    });

    it('keeps a custom placeholder when its deletion is cancelled', async () => {
        const user = userEvent.setup();
        mockConfirm.mockResolvedValue(false);
        await renderPage();

        await user.click(await screen.findByRole('button', { name: 'Delete placeholder Project name' }));

        await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
        expect(deletePlaceholder).not.toHaveBeenCalled();
    });

    it('deletes a custom placeholder after confirmation', async () => {
        const user = userEvent.setup();
        mockConfirm.mockResolvedValue(true);
        await renderPage();

        await user.click(await screen.findByRole('button', { name: 'Delete placeholder Project name' }));

        await waitFor(() => expect(vi.mocked(deletePlaceholder).mock.calls[0]?.[0]).toBe('1'));
    });

    it('opens the new placeholder form from the page header', async () => {
        const user = userEvent.setup();
        await renderPage();

        await user.click(await screen.findByRole('button', { name: 'New placeholder' }));

        expect(await screen.findByRole('dialog', { name: 'New placeholder' })).toBeInTheDocument();
    });
});
