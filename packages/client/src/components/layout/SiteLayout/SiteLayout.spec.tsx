import { fireEvent, render, screen, within } from '@testing-library/react';

import SiteLayout from './SiteLayout';

vi.mock('@tanstack/react-router', () => ({
    useLocation: ({ select }: { select: (location: { pathname: string }) => string }) => select({ pathname: '/notes' }),
}));

vi.mock('./SidebarHeroBanner', () => ({ default: () => null }));

vi.mock('./SidebarSearch', () => ({ default: () => null }));

vi.mock('./SidebarPrimaryActions', () => ({ default: () => null }));

vi.mock('./SidebarPinnedNotes', () => ({ default: () => null }));

vi.mock('~/components/demo/DemoSidebarPromoSlot', () => ({ default: () => null }));

vi.mock('./TopNavigation', () => ({ default: () => null }));

describe('<SiteLayout />', () => {
    it('renders page content inside the main layout and exposes the sidebar toggle', () => {
        render(
            <SiteLayout>
                <h1>Page Content</h1>
            </SiteLayout>,
        );

        const main = screen.getByRole('main');
        const sidebar = screen.getByRole('complementary');
        const toggle = screen.getByRole('button', { name: 'Toggle sidebar' });

        expect(within(main).getByRole('heading', { name: 'Page Content' })).toBeInTheDocument();
        expect(toggle).toHaveAttribute('aria-controls', sidebar.id);
        expect(toggle).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(toggle);

        expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });
});
