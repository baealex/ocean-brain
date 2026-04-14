import { QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { deleteImage, fetchImage } from '~/apis/image.api';
import { fetchImageNotes } from '~/apis/note.api';
import { setServerCache } from '~/apis/server-cache.api';
import { queryKeys } from '~/modules/query-key-factory';
import { SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE, SETTINGS_MANAGE_IMAGE_ROUTE } from '~/modules/url';
import { createTestQueryClient } from '~/test/test-utils';

import ManageImageDetail from './manage-image-detail';

const mockConfirm = vi.fn();
const mockToast = vi.fn();

vi.mock('~/apis/image.api', () => ({
    deleteImage: vi.fn(),
    fetchImage: vi.fn(),
}));

vi.mock('~/apis/note.api', () => ({ fetchImageNotes: vi.fn() }));

vi.mock('~/apis/server-cache.api', () => ({ setServerCache: vi.fn() }));

vi.mock('~/components/ui', async () => {
    const actual = await vi.importActual<object>('~/components/ui');

    return {
        ...actual,
        useConfirm: () => mockConfirm,
        useToast: () => mockToast,
    };
});

vi.mock('~/components/shared', async () => {
    const actual = await vi.importActual<object>('~/components/shared');

    return {
        ...actual,
        Image: ({ src, alt, className }: { src: string; alt?: string; className?: string }) => (
            <img src={src} alt={alt} className={className} />
        ),
    };
});

const renderPage = async () => {
    window.history.pushState({}, '', '/setting/manage-image/image-1');

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    const rootRoute = createRootRoute({ component: () => <Outlet /> });
    const manageImageRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: SETTINGS_MANAGE_IMAGE_ROUTE,
        component: () => null,
    });
    const manageImageDetailRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: SETTINGS_MANAGE_IMAGE_DETAIL_ROUTE,
        component: ManageImageDetail,
    });
    const router = createRouter({
        routeTree: rootRoute.addChildren([manageImageRoute, manageImageDetailRoute]),
    });

    render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    );

    await act(async () => {
        await router.load();
    });

    return { invalidateSpy };
};

describe('<ManageImageDetail />', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(deleteImage).mockResolvedValue({
            type: 'success',
            deleteImage: true,
        });
        vi.mocked(fetchImage).mockResolvedValue({
            type: 'success',
            image: {
                id: 'image-1',
                url: 'https://example.com/hero.jpg',
            },
        });
        vi.mocked(fetchImageNotes).mockResolvedValue({
            type: 'success',
            imageNotes: [],
        });
    });

    it('updates the hero banner and invalidates the sidebar cache query', async () => {
        vi.mocked(setServerCache).mockResolvedValue({
            type: 'success',
            setCache: { value: encodeURIComponent('https://example.com/hero.jpg') },
        });

        const { invalidateSpy } = await renderPage();

        await userEvent.click(await screen.findByRole('button', { name: 'Set hero banner' }));

        await waitFor(() => {
            expect(setServerCache).toHaveBeenCalledWith('heroBanner', 'https://example.com/hero.jpg');
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: queryKeys.ui.heroBanner(),
                exact: true,
            });
            expect(mockToast).toHaveBeenCalledWith('Hero banner updated');
        });
    });
});
