import { RouterProvider } from '@tanstack/react-router';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { createTestRouter } from '~/test/create-test-router';

import LayoutShell from './LayoutShell';

describe('<LayoutShell />', () => {
    it('renders the shell slots and outlet content', async () => {
        const router = createTestRouter({
            initialPath: '/',
            routePath: '/',
            rootComponent: () => (
                <LayoutShell sidebar={<div>Sidebar</div>} topNavigation={<div>Top Navigation</div>}>
                    <div>Page Content</div>
                </LayoutShell>
            ),
            routeComponent: () => null,
        });

        render(<RouterProvider router={router} />);
        await act(async () => {
            await router.load();
        });

        expect(await screen.findByText('Sidebar')).toBeInTheDocument();
        expect(await screen.findByText('Top Navigation')).toBeInTheDocument();
        expect(await screen.findByText('Page Content')).toBeInTheDocument();
    });

    it('exposes the mobile sidebar toggle as an accessible stateful control', async () => {
        const router = createTestRouter({
            initialPath: '/',
            routePath: '/',
            rootComponent: () => (
                <LayoutShell sidebar={<div>Sidebar</div>} topNavigation={<div>Top Navigation</div>}>
                    <div>Page Content</div>
                </LayoutShell>
            ),
            routeComponent: () => null,
        });

        render(<RouterProvider router={router} />);
        await act(async () => {
            await router.load();
        });

        const toggleButton = screen.getByRole('button', { name: 'Toggle sidebar' });

        expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(toggleButton);

        expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    });
});
