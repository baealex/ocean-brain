import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { fetchNotes } from '~/apis/note.api';
import { fetchSearchAdminStatus } from '~/apis/search-admin.api';
import { SEARCH_ROUTE } from '~/modules/url';
import { createTestQueryClient } from '~/test/test-utils';

import SidebarSearch from './SidebarSearch';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
    useNavigate: () => mockNavigate,
}));

vi.mock('~/apis/note.api', () => ({ fetchNotes: vi.fn() }));
vi.mock('~/apis/search-admin.api', () => ({ fetchSearchAdminStatus: vi.fn() }));

const createStatus = (enabled: boolean) => ({
    config: {
        enabled,
        baseUrl: enabled ? 'http://127.0.0.1:1234/v1' : '',
        model: enabled ? 'text-embedding-qwen' : '',
        queryInstruction: '',
    },
    phase: enabled ? ('needs-index' as const) : ('disabled' as const),
    available: false,
    needsReindex: enabled,
    noteCount: 0,
    chunkCount: 0,
    indexedAt: null,
    dimensions: null,
    progress: null,
    error: null,
});

const renderSearch = () =>
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <SidebarSearch />
        </QueryClientProvider>,
    );

describe('<SidebarSearch />', () => {
    beforeEach(() => {
        vi.mocked(fetchSearchAdminStatus).mockResolvedValue(createStatus(false));
    });

    it('keeps the existing quick keyword search when embedding is not configured', async () => {
        vi.mocked(fetchNotes).mockResolvedValue({
            type: 'success',
            allNotes: {
                notes: [{ id: 'note-1', title: 'Alpha note' }],
            },
        } as never);

        renderSearch();

        const input = await screen.findByRole('textbox', { name: 'Quick search notes' });
        fireEvent.change(input, { target: { value: 'alpha' } });

        await waitFor(
            () => {
                expect(fetchNotes).toHaveBeenCalledWith({ query: 'alpha', limit: 5 });
            },
            { timeout: 1_500 },
        );
        expect(await screen.findByText('Alpha note')).toBeInTheDocument();

        fireEvent.submit(input.closest('form') as HTMLFormElement);
        expect(mockNavigate).toHaveBeenCalledWith({
            to: SEARCH_ROUTE,
            search: {
                query: 'alpha',
                page: 1,
                mode: 'lexical',
            },
        });
    });

    it('uses a compact route button once embedding is enabled', async () => {
        vi.mocked(fetchSearchAdminStatus).mockResolvedValue(createStatus(true));

        renderSearch();

        const button = await screen.findByRole('button', { name: 'Go to note search' });
        fireEvent.click(button);

        expect(mockNavigate).toHaveBeenCalledWith({
            to: SEARCH_ROUTE,
            search: {
                query: '',
                page: 1,
                mode: 'hybrid',
            },
        });
        expect(screen.queryByRole('textbox', { name: 'Quick search notes' })).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
