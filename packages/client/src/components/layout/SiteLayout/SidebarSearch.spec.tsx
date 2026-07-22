import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { fetchSearchNotes } from '~/apis/search.api';
import { SEARCH_ROUTE } from '~/modules/url';
import { createTestQueryClient } from '~/test/test-utils';

import SidebarSearch from './SidebarSearch';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
    useNavigate: () => mockNavigate,
}));

vi.mock('~/apis/search.api', () => ({ fetchSearchNotes: vi.fn() }));

const renderSearch = () =>
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <SidebarSearch />
        </QueryClientProvider>,
    );

describe('<SidebarSearch />', () => {
    it('opens one unified search dialog and runs the default combined search', async () => {
        vi.mocked(fetchSearchNotes).mockResolvedValue({
            type: 'success',
            searchNotes: {
                totalCount: 1,
                semanticAvailable: true,
                semanticUsed: true,
                semanticError: null,
                matches: [{ noteId: 'note-1', lexical: false, semantic: true }],
                notes: [
                    {
                        id: 'note-1',
                        title: 'A half-remembered story',
                        content: '[]',
                        pinned: false,
                        tags: [],
                        createdAt: '2026-01-01T00:00:00.000Z',
                        updatedAt: '2026-01-01T00:00:00.000Z',
                    },
                ],
            },
        });

        renderSearch();

        fireEvent.click(screen.getByRole('button', { name: 'Open note search' }));
        expect(screen.getByRole('dialog', { name: 'Search notes' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');

        fireEvent.change(screen.getByRole('searchbox', { name: 'Search notes' }), {
            target: { value: 'vague memory' },
        });

        await waitFor(() => {
            expect(fetchSearchNotes).toHaveBeenCalledWith({
                query: 'vague memory',
                limit: 8,
                offset: 0,
                mode: 'hybrid',
            });
        });
        expect(await screen.findByText('A half-remembered story')).toBeInTheDocument();
        expect(screen.getByText('Meaning match')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('radio', { name: 'Meaning' }));
        await waitFor(() => {
            expect(fetchSearchNotes).toHaveBeenCalledWith({
                query: 'vague memory',
                limit: 8,
                offset: 0,
                mode: 'semantic',
            });
        });
        expect(screen.getByText(/related ideas even when your note uses different words/i)).toBeInTheDocument();
    });

    it('opens the dedicated search page directly on mobile', async () => {
        const user = userEvent.setup();
        vi.mocked(window.matchMedia).mockImplementation(
            (query) =>
                ({
                    matches: query === '(max-width: 767px)',
                    media: query,
                    onchange: null,
                    addListener: vi.fn(),
                    removeListener: vi.fn(),
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn(),
                    dispatchEvent: vi.fn(),
                }) as MediaQueryList,
        );

        renderSearch();
        await user.click(screen.getByRole('button', { name: 'Open note search' }));

        expect(mockNavigate).toHaveBeenCalledWith({
            to: SEARCH_ROUTE,
            search: {
                query: '',
                page: 1,
                mode: 'hybrid',
            },
        });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
