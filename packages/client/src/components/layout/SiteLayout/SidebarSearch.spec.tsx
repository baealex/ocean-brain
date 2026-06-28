import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fetchNotes } from '~/apis/note.api';
import { SEARCH_ROUTE } from '~/modules/url';

import SidebarSearch from './SidebarSearch';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
    useNavigate: () => mockNavigate,
}));

vi.mock('~/apis/note.api', () => ({ fetchNotes: vi.fn() }));

describe('<SidebarSearch />', () => {
    it('renders debounced note suggestions and labelled controls', async () => {
        const user = userEvent.setup();

        vi.mocked(fetchNotes).mockResolvedValue({
            type: 'success',
            allNotes: {
                notes: [
                    {
                        id: 'note-1',
                        title: 'Alpha note',
                    },
                ],
            },
        } as never);

        render(<SidebarSearch />);

        await user.type(screen.getByRole('textbox'), 'alpha');

        expect(screen.getByRole('button', { name: 'Search notes' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();

        await waitFor(() => {
            expect(fetchNotes).toHaveBeenCalledWith({
                query: 'alpha',
                limit: 5,
            });
        });

        expect(await screen.findByText('Alpha note')).toBeInTheDocument();
    });

    it('navigates to the search route on submit', async () => {
        const user = userEvent.setup();

        render(<SidebarSearch />);

        await user.type(screen.getByRole('textbox'), 'waves{Enter}');

        expect(mockNavigate).toHaveBeenCalledWith({
            to: SEARCH_ROUTE,
            search: {
                query: 'waves',
                page: 1,
            },
        });
    });
});
