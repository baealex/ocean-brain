import { QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';
import { SETTINGS_MANAGE_IMAGE_ROUTE } from '~/modules/url';
import { createTestQueryClient } from '~/test/test-utils';
import ManageImage from './manage-image';

vi.mock('~/components/app', () => ({ QueryBoundary: ({ children }: { children: React.ReactNode }) => children }));

vi.mock('~/components/entities', () => ({
    Images: ({ render }: { render: (data: { images: never[]; totalCount: number }) => React.ReactNode }) =>
        render({
            images: [],
            totalCount: 0,
        }),
}));

vi.mock('~/hooks/useGridLimit', () => ({
    useGridLimit: () => ({
        containerRef: { current: null },
        limit: 12,
    }),
}));

vi.mock('~/components/ui', async () => {
    const actual = await vi.importActual<object>('~/components/ui');
    return {
        ...actual,
        useConfirm: () => vi.fn(),
    };
});

describe('<ManageImage />', () => {
    it('renders the empty state when there are no images', async () => {
        window.history.pushState({}, '', `${SETTINGS_MANAGE_IMAGE_ROUTE}?page=1`);

        const queryClient = createTestQueryClient();
        const rootRoute = createRootRoute({ component: () => <ManageImage /> });
        const route = createRoute({
            getParentRoute: () => rootRoute,
            path: SETTINGS_MANAGE_IMAGE_ROUTE,
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

        expect(screen.getByRole('heading', { name: 'Images' })).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
});
