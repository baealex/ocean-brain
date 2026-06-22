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

        const root = screen.getByText('Page Content').closest('main')?.parentElement;
        const main = screen.getByText('Page Content').closest('main');

        expect(root).toHaveClass('h-dvh', 'overflow-hidden');
        expect(main).toHaveClass('min-h-0', 'overflow-y-auto', 'overscroll-contain');
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
        const sidebar = screen.getByText('Sidebar').closest('aside');

        expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
        expect(sidebar).toHaveClass('pointer-events-none');

        fireEvent.click(toggleButton);

        expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
        expect(sidebar).toHaveClass('pointer-events-auto');
        expect(sidebar).not.toHaveClass('pointer-events-none');
    });
});
