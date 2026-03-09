import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';

import SiteLayout from './SiteLayout';

vi.mock('./LayoutShell', () => ({
    default: ({
        sidebar,
        topNavigation,
        children
    }: {
        sidebar: ReactNode;
        topNavigation: ReactNode;
        children?: ReactNode;
    }) => (
        <div>
            <div data-testid="sidebar-slot">{sidebar}</div>
            <div data-testid="top-navigation-slot">{topNavigation}</div>
            <div data-testid="content-slot">{children}</div>
        </div>
    )
}));

vi.mock('./SidebarHeroBanner', () => ({ default: () => <div>Hero Banner</div> }));

vi.mock('./SidebarSearch', () => ({ default: () => <div>Sidebar Search</div> }));

vi.mock('./SidebarPrimaryActions', () => ({ default: () => <div>Primary Actions</div> }));

vi.mock('./TopNavigation', () => ({ default: () => <div>Top Navigation</div> }));

describe('<SiteLayout />', () => {
    it('composes the sidebar, top navigation, and page content', () => {
        render(
            <SiteLayout>
                <div>Page Content</div>
            </SiteLayout>
        );

        expect(screen.getByTestId('sidebar-slot')).toHaveTextContent('Hero Banner');
        expect(screen.getByTestId('sidebar-slot')).toHaveTextContent('Sidebar Search');
        expect(screen.getByTestId('sidebar-slot')).toHaveTextContent('Primary Actions');
        expect(screen.getByTestId('top-navigation-slot')).toHaveTextContent('Top Navigation');
        expect(screen.getByTestId('content-slot')).toHaveTextContent('Page Content');
    });
});
