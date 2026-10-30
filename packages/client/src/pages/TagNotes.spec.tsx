import { QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    Outlet,
    RouterProvider,
    useSearch,
} from '@tanstack/react-router';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fetchTagNotes } from '~/apis/note.api';
import { validatePaginationSearch } from '~/modules/route-search';
import { TAG_NOTES_ROUTE, TAG_ROUTE } from '~/modules/url';
import { createTestQueryClient } from '~/test/test-utils';
import TagNotes from './TagNotes';

const workspaceState = vi.hoisted(() => ({ workspaceId: '1', multiple: false }));

vi.mock('~/apis/note.api', () => ({ fetchTagNotes: vi.fn() }));
vi.mock('~/store/workspace', () => ({ useWorkspace: () => workspaceState }));
vi.mock('~/hooks/resource/useNoteMutate', () => ({
    default: () => ({ onDelete: vi.fn(), onPinned: vi.fn(), deleteWarningDialog: null }),
}));

const TagCatalogPage = () => {
    const search = useSearch({ strict: false }) as { workspace?: unknown };

    return <p>Tag catalog in workspace {String(search.workspace ?? 'default')}</p>;
};

const renderPage = async () => {
    const rootRoute = createRootRoute({ component: () => <Outlet /> });
    const tagRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: TAG_ROUTE,
        component: TagCatalogPage,
    });
    const tagNotesRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: TAG_NOTES_ROUTE,
        component: TagNotes,
        validateSearch: validatePaginationSearch,
    });
    const router = createRouter({
        routeTree: rootRoute.addChildren([tagRoute, tagNotesRoute]),
        history: createMemoryHistory({ initialEntries: ['/tag/5?page=1'] }),
    });

    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    );
    await act(async () => {
        await router.load();
    });
};

describe('<TagNotes />', () => {
    beforeEach(() => {
        workspaceState.workspaceId = '1';
        workspaceState.multiple = false;
        vi.mocked(fetchTagNotes).mockResolvedValue({
            type: 'success',
            tagNotes: { notes: [], totalCount: 0 },
        });
    });

    it('links back to the tag catalog', async () => {
        await renderPage();

        const backLink = await screen.findByRole('link', { name: 'Tags' });

        expect(new URL(backLink.getAttribute('href') ?? '', window.location.origin).pathname).toBe(TAG_ROUTE);
    });

    it('keeps the current workspace on the way back to the tag catalog', async () => {
        const user = userEvent.setup();
        workspaceState.workspaceId = '2';
        workspaceState.multiple = true;
        await renderPage();

        await user.click(await screen.findByRole('link', { name: 'Tags' }));

        expect(await screen.findByText('Tag catalog in workspace 2')).toBeInTheDocument();
    });
});
