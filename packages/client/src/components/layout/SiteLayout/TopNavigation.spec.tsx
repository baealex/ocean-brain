import { QueryClientProvider } from '@tanstack/react-query';
import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    Outlet,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { GRAPH_ROUTE, HOME_ROUTE, NOTE_ROUTE, SEARCH_ROUTE, VIEWS_ROUTE } from '~/modules/url';
import { createTestQueryClient } from '~/test/test-utils';

import TopNavigation from './TopNavigation';

vi.mock('~/apis/integration.api', () => ({ fetchIntegrations: vi.fn(async () => []) }));
vi.mock('~/apis/navigation-settings.api', () => ({
    fetchNavigationSettings: vi.fn(async () => ({ preferences: null, revision: null, status: 'ready' })),
}));

// jsdom does not implement scrolling, so the browser API is the observable boundary here.
const scrollIntoView = vi.fn();

beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
});

afterAll(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

beforeEach(() => {
    scrollIntoView.mockClear();
});

const renderNavigation = async (initialPath: string) => {
    const rootRoute = createRootRoute({
        component: () => (
            <>
                <TopNavigation />
                <Outlet />
            </>
        ),
    });

    const homeRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: HOME_ROUTE,
        component: () => <div>Home</div>,
    });

    const graphRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: GRAPH_ROUTE,
        component: () => <div>Graph</div>,
    });

    const noteRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: NOTE_ROUTE,
        component: () => <div>Note</div>,
    });

    const router = createRouter({
        routeTree: rootRoute.addChildren([homeRoute, graphRoute, noteRoute]),
        history: createMemoryHistory({ initialEntries: [initialPath] }),
    });

    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    );
    await act(async () => {
        await router.load();
    });

    return { router, navigation: await screen.findByRole('navigation', { name: 'Primary navigation' }) };
};

describe('<TopNavigation />', () => {
    it('renders the primary navigation items', async () => {
        const { navigation } = await renderNavigation(GRAPH_ROUTE);
        const graphLink = within(navigation).getByRole('link', { name: /graph/i });
        const searchLink = within(navigation).getByRole('link', { name: /search/i });
        const notesLink = within(navigation).getByRole('link', { name: /notes/i });
        const viewsLink = within(navigation).getByRole('link', { name: /views/i });

        expect(graphLink).toHaveAttribute('href', GRAPH_ROUTE);
        expect(searchLink).toHaveAttribute('href', SEARCH_ROUTE);
        expect(searchLink).toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K');
        expect(graphLink).toHaveAttribute('aria-current', 'page');
        expect(notesLink).toHaveAttribute('href', HOME_ROUTE);
        expect(viewsLink).toHaveAttribute('href', VIEWS_ROUTE);
    });

    it('scrolls the active destination into view when the page opens', async () => {
        const { navigation } = await renderNavigation(GRAPH_ROUTE);
        const graphLink = within(navigation).getByRole('link', { name: /graph/i });

        await waitFor(() => {
            expect(scrollIntoView.mock.contexts.at(-1)).toBe(graphLink);
        });
        expect(scrollIntoView).toHaveBeenLastCalledWith({ inline: 'center', block: 'nearest' });
    });

    it('scrolls the new destination into view after navigation', async () => {
        const { router, navigation } = await renderNavigation(GRAPH_ROUTE);

        await act(async () => {
            await router.navigate({ to: HOME_ROUTE });
        });

        const notesLink = within(navigation).getByRole('link', { name: /notes/i });
        await waitFor(() => {
            expect(scrollIntoView.mock.contexts.at(-1)).toBe(notesLink);
        });
    });

    it('scrolls the Search tab into view when a note opens from another tab', async () => {
        const { router, navigation } = await renderNavigation(GRAPH_ROUTE);

        await act(async () => {
            await router.navigate({ to: NOTE_ROUTE, params: { id: '42' } });
        });

        const searchLink = within(navigation).getByRole('link', { name: /search/i });
        await waitFor(() => {
            expect(scrollIntoView.mock.contexts.at(-1)).toBe(searchLink);
        });
    });

    it('keeps the tabs still when a new note moves to its saved address', async () => {
        const { router } = await renderNavigation('/new');
        scrollIntoView.mockClear();

        await act(async () => {
            await router.navigate({ to: NOTE_ROUTE, params: { id: '42' }, replace: true });
        });

        expect(scrollIntoView).not.toHaveBeenCalled();
    });
});
