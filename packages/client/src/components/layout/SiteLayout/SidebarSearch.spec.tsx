import { fireEvent, render, screen } from '@testing-library/react';

import { SEARCH_ROUTE } from '~/modules/url';

import SidebarSearch from './SidebarSearch';

const mockNavigate = vi.fn();
const locationState = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
    useNavigate: () => mockNavigate,
    useLocation: ({ select }: { select: (location: { pathname: string }) => unknown }) => select(locationState),
}));

const renderSearch = () => render(<SidebarSearch />);

describe('<SidebarSearch />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        locationState.pathname = '/';
    });

    it('opens the detailed search page without collecting a query in the sidebar', () => {
        renderSearch();

        const launcher = screen.getByRole('button', { name: 'Open detailed search' });
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

        fireEvent.click(launcher);
        expect(mockNavigate).toHaveBeenCalledWith({
            to: SEARCH_ROUTE,
            search: {
                query: '',
                page: 1,
                mode: 'hybrid',
            },
        });
    });

    it('marks the launcher as the current page while search is open', () => {
        locationState.pathname = SEARCH_ROUTE;

        renderSearch();

        expect(screen.getByRole('button', { name: 'Open detailed search' })).toHaveAttribute('aria-current', 'page');
    });

    it('does not mark the launcher as current on other pages', () => {
        renderSearch();

        expect(screen.getByRole('button', { name: 'Open detailed search' })).not.toHaveAttribute('aria-current');
    });
});
