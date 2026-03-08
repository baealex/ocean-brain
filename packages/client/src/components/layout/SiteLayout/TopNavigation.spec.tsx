import { render, screen } from '@testing-library/react';
import {
    Outlet,
    RouterProvider,
    createRootRoute,
    createRoute,
    createRouter
} from '@tanstack/react-router';

import { GRAPH_ROUTE, HOME_ROUTE } from '~/modules/url';

import TopNavigation from './TopNavigation';

describe('<TopNavigation />', () => {
    it('renders the primary navigation items', () => {
        window.history.pushState({}, '', GRAPH_ROUTE);

        const rootRoute = createRootRoute({
            component: () => (
                <>
                    <TopNavigation />
                    <Outlet />
                </>
            )
        });

        const homeRoute = createRoute({
            getParentRoute: () => rootRoute,
            path: HOME_ROUTE,
            component: () => <div>Home</div>
        });

        const graphRoute = createRoute({
            getParentRoute: () => rootRoute,
            path: GRAPH_ROUTE,
            component: () => <div>Graph</div>
        });

        const router = createRouter({ routeTree: rootRoute.addChildren([homeRoute, graphRoute]) });

        render(<RouterProvider router={router} />);

        expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
        expect(screen.getByText('Graph')).toBeInTheDocument();
        expect(screen.getByText('Notes')).toBeInTheDocument();
    });
});
