import {
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
    Outlet,
    RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import LayoutShell from './LayoutShell';

const createLayoutRouter = () => {
    const rootRoute = createRootRoute({
        component: () => (
            <LayoutShell sidebar={<div>Sidebar</div>} topNavigation={<div>Top Navigation</div>}>
                <Outlet />
            </LayoutShell>
        ),
    });
    const homeRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => <div>Home page</div>,
    });
    const nextRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/next',
        component: () => <div>Next page</div>,
    });

    return createRouter({
        routeTree: rootRoute.addChildren([homeRoute, nextRoute]),
        history: createMemoryHistory({ initialEntries: ['/'] }),
    });
};

const renderLayout = async () => {
    const router = createLayoutRouter();
    render(<RouterProvider router={router} />);

    await act(async () => {
        await router.load();
    });

    return router;
};

describe('<LayoutShell />', () => {
    it('exposes the mobile sidebar toggle as an accessible stateful control', async () => {
        const user = userEvent.setup();
        await renderLayout();
        const toggleButton = screen.getByRole('button', { name: 'Toggle sidebar' });
        const sidebar = screen.getByText('Sidebar').closest('aside');

        expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
        expect(toggleButton).toHaveAttribute('aria-controls', sidebar?.id);

        await user.click(toggleButton);

        expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes the mobile sidebar after route navigation', async () => {
        const user = userEvent.setup();
        const router = await renderLayout();
        const toggleButton = screen.getByRole('button', { name: 'Toggle sidebar' });
        await user.click(toggleButton);
        expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

        await act(async () => {
            await router.navigate({ to: '/next' });
        });

        await waitFor(() => {
            expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
        });
    });
});
