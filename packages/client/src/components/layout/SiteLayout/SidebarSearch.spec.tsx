import { fireEvent, render, screen } from '@testing-library/react';

import { SEARCH_ROUTE } from '~/modules/url';

import SidebarSearch from './SidebarSearch';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
    useNavigate: () => mockNavigate,
}));

const renderSearch = () => render(<SidebarSearch />);

describe('<SidebarSearch />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
});
