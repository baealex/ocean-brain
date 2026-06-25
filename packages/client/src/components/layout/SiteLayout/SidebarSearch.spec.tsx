import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
    it('renders debounced note suggestions', async () => {
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

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'alpha' } });

        await waitFor(() => {
            expect(fetchNotes).toHaveBeenCalledWith({
                query: 'alpha',
                limit: 5,
            });
        });

        expect(await screen.findByText('Alpha note')).toBeInTheDocument();
    });

    it('navigates to the search route on submit', () => {
        render(<SidebarSearch />);

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'waves' } });
        fireEvent.submit(screen.getByRole('textbox').closest('form')!);

        expect(mockNavigate).toHaveBeenCalledWith({
            to: SEARCH_ROUTE,
            search: {
                query: 'waves',
                page: 1,
            },
        });
    });
});
