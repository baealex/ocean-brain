import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { fetchNotes } from '~/apis/note.api';
import { fetchTags } from '~/apis/tag.api';
import { SEARCH_ROUTE } from '~/modules/url';

import SidebarSearch from './SidebarSearch';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
    useNavigate: () => mockNavigate
}));

vi.mock('~/apis/note.api', () => ({ fetchNotes: vi.fn() }));

vi.mock('~/apis/tag.api', () => ({ fetchTags: vi.fn() }));

describe('<SidebarSearch />', () => {
    it('renders debounced note and tag suggestions', async () => {
        vi.mocked(fetchNotes).mockResolvedValue({
            type: 'success',
            allNotes: {
                notes: [{
                    id: 'note-1',
                    title: 'Alpha note'
                }]
            }
        } as never);
        vi.mocked(fetchTags).mockResolvedValue({
            type: 'success',
            allTags: {
                tags: [{
                    id: 'tag-1',
                    name: 'alpha'
                }]
            }
        } as never);

        render(<SidebarSearch />);

        fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'alpha' } });

        await waitFor(() => {
            expect(fetchNotes).toHaveBeenCalledWith({
                query: 'alpha',
                limit: 5
            });
            expect(fetchTags).toHaveBeenCalledWith({
                query: 'alpha',
                limit: 5
            });
        });

        expect(await screen.findByText('Alpha note')).toBeInTheDocument();
        expect(await screen.findByText('alpha')).toBeInTheDocument();
    });

    it('navigates to the search route on submit', () => {
        render(<SidebarSearch />);

        fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'waves' } });
        fireEvent.submit(screen.getByRole('textbox').closest('form')!);

        expect(mockNavigate).toHaveBeenCalledWith({
            to: SEARCH_ROUTE,
            search: {
                query: 'waves',
                page: 1
            }
        });
    });
});
