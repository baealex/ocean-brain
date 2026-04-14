import { createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { act, render, screen, within } from '@testing-library/react';

import { GRAPH_ROUTE, HOME_ROUTE } from '~/modules/url';

import TopNavigation from './TopNavigation';

describe('<TopNavigation />', () => {
    it('renders the primary navigation items', async () => {
        window.history.pushState({}, '', GRAPH_ROUTE);

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

        const router = createRouter({ routeTree: rootRoute.addChildren([homeRoute, graphRoute]) });

        render(<RouterProvider router={router} />);
        await act(async () => {
            await router.load();
        });

        const navigation = await screen.findByRole('navigation', { name: 'Primary navigation' });
        const graphLink = within(navigation).getByRole('link', { name: /graph/i });
        const notesLink = within(navigation).getByRole('link', { name: /notes/i });

        expect(graphLink).toHaveAttribute('href', GRAPH_ROUTE);
        expect(graphLink).toHaveAttribute('aria-current', 'page');
        expect(notesLink).toHaveAttribute('href', HOME_ROUTE);
    });
});
