import axios from 'axios';
import { render } from '@testing-library/react';
import {
    Outlet,
    RouterProvider,
    createRootRoute,
    createRoute,
    createRouter
} from '@tanstack/react-router';

import { Providers } from '~/components/app';

import SiteLayout from './SiteLayout';

describe('<SiteLayout />', () => {
    it('renders the composed site layout', () => {
        window.history.pushState({}, '', '/');

        axios.post = async () => ({
            data: {
                data: {
                    cache: { value: '' },
                    pinnedNotes: []
                }
            }
        });

        const rootRoute = createRootRoute({
            component: () => (
                <Providers>
                    <SiteLayout>
                        <Outlet />
                    </SiteLayout>
                </Providers>
            )
        });

        const homeRoute = createRoute({
            getParentRoute: () => rootRoute,
            path: '/',
            component: () => <div>Page Content</div>
        });

        const router = createRouter({ routeTree: rootRoute.addChildren([homeRoute]) });

        const { container } = render(<RouterProvider router={router} />);

        expect(container).toBeInTheDocument();
    });
});
