import { QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { deleteImage } from '~/apis/image.api';
import { SETTINGS_MANAGE_IMAGE_ROUTE } from '~/modules/url';
import { createTestQueryClient } from '~/test/test-utils';
import ManageImage from './manage-image';

const mockConfirm = vi.fn();

const mockImageData = vi.hoisted(() => ({
    images: [] as Array<{ id: string; url: string; referenceCount: number }>,
    totalCount: 0,
}));

vi.mock('~/components/app', () => ({ QueryBoundary: ({ children }: { children: React.ReactNode }) => children }));

vi.mock('~/apis/image.api', () => ({ deleteImage: vi.fn() }));

vi.mock('~/components/entities', () => ({
    Images: ({
        render,
    }: {
        render: (data: {
            images: Array<{ id: string; url: string; referenceCount: number }>;
            totalCount: number;
        }) => React.ReactNode;
    }) => render(mockImageData),
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
        useConfirm: () => mockConfirm,
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
};

describe('<ManageImage />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockImageData.images = [];
        mockImageData.totalCount = 0;
        vi.mocked(deleteImage).mockResolvedValue({ type: 'success', deleteImage: true });
    });

    it('renders the empty state when there are no images', async () => {
        await renderPage();

        expect(screen.getByRole('heading', { name: 'Images' })).toBeInTheDocument();
        expect(screen.getByText('There are no images')).toBeInTheDocument();
        expect(screen.getByText('Upload an image in any note and it will appear here')).toBeInTheDocument();
    });

    it('labels the icon-only image delete button with target context', async () => {
        mockImageData.images = [
            {
                id: 'image-1',
                url: '/image-1.png',
                referenceCount: 0,
            },
        ];
        mockImageData.totalCount = 1;

        await renderPage();

        expect(screen.getByRole('button', { name: 'Delete image image-1' })).toBeInTheDocument();
    });

    it('allows deleting a referenced image after an impact warning', async () => {
        mockConfirm.mockResolvedValue(true);
        mockImageData.images = [
            {
                id: 'image-1',
                url: '/image-1.png',
                referenceCount: 2,
            },
        ];
        mockImageData.totalCount = 1;
        await renderPage();

        const deleteButton = screen.getByRole('button', { name: 'Delete image image-1' });
        expect(deleteButton).toBeEnabled();
        await userEvent.click(deleteButton);

        await waitFor(() => {
            expect(mockConfirm).toHaveBeenCalledWith(
                'Delete this image? It is referenced by 2 notes, which will show a broken image. This cannot be undone.',
            );
            expect(vi.mocked(deleteImage).mock.calls[0]?.[0]).toBe('image-1');
        });
    });
});
