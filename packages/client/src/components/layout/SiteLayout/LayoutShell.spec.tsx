import { act, render, screen } from '@testing-library/react';
import { RouterProvider } from '@tanstack/react-router';

import { createTestRouter } from '~/test/create-test-router';

import LayoutShell from './LayoutShell';

describe('<LayoutShell />', () => {
    it('renders the shell slots and outlet content', async () => {
        const router = createTestRouter({
            initialPath: '/',
            routePath: '/',
            rootComponent: () => (
                <LayoutShell
                    sidebar={<div>Sidebar</div>}
                    topNavigation={<div>Top Navigation</div>}>
                    <div>Page Content</div>
                </LayoutShell>
            ),
            routeComponent: () => null
        });

        render(<RouterProvider router={router} />);
        await act(async () => {
            await router.load();
        });

        expect(await screen.findByText('Sidebar')).toBeInTheDocument();
        expect(await screen.findByText('Top Navigation')).toBeInTheDocument();
        expect(await screen.findByText('Page Content')).toBeInTheDocument();
    });
});
