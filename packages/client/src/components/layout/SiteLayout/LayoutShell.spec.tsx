import { render, screen } from '@testing-library/react';
import {
    Outlet,
    RouterProvider,
    createRootRoute,
    createRoute,
    createRouter
} from '@tanstack/react-router';

import LayoutShell from './LayoutShell';

describe('<LayoutShell />', () => {
    it('renders the shell slots and outlet content', () => {
        window.history.pushState({}, '', '/');

        const rootRoute = createRootRoute({
            component: () => (
                <LayoutShell
                    sidebar={<div>Sidebar</div>}
                    topNavigation={<div>Top Navigation</div>}>
                    <Outlet />
                </LayoutShell>
            )
        });

        const homeRoute = createRoute({
            getParentRoute: () => rootRoute,
            path: '/',
            component: () => <div>Page Content</div>
        });

        const router = createRouter({ routeTree: rootRoute.addChildren([homeRoute]) });

        render(<RouterProvider router={router} />);

        expect(screen.getByText('Sidebar')).toBeInTheDocument();
        expect(screen.getByText('Top Navigation')).toBeInTheDocument();
        expect(screen.getByText('Page Content')).toBeInTheDocument();
    });
});
