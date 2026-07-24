import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import * as searchApi from '~/apis/search.api';
import { fetchSearchAdminStatus } from '~/apis/search-admin.api';
import { SEARCH_ROUTE } from '~/modules/url';
import { createTestQueryClient } from '~/test/test-utils';

import SidebarSearch from './SidebarSearch';

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
    useNavigate: () => mockNavigate,
}));

vi.mock('~/apis/search.api', () => ({ fetchSearchNotes: vi.fn() }));
vi.mock('~/apis/search-admin.api', () => ({ fetchSearchAdminStatus: vi.fn() }));

const createStatus = (enabled: boolean, available = enabled) => ({
    config: {
        enabled,
        baseUrl: enabled ? 'http://127.0.0.1:1234/v1' : '',
        model: enabled ? 'text-embedding-qwen' : '',
        queryInstruction: '',
    },
    connectionValidated: enabled,
    apiKeyConfigured: false,
    phase: available ? ('ready' as const) : enabled ? ('needs-index' as const) : ('disabled' as const),
    available,
    needsReindex: enabled && !available,
    noteCount: 0,
    chunkCount: 0,
    indexedAt: null,
    dimensions: null,
    pendingNoteCount: 0,
    lastSyncedAt: null,
    syncError: null,
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

    it('uses the same keyword search results in the sidebar when embedding is not configured', async () => {
        vi.mocked(searchApi.fetchSearchNotes).mockResolvedValue({
            type: 'success',
            searchNotes: {
                totalCount: 1,
                notes: [{ id: 'note-1', title: 'Alpha note' }],
                matches: [{ noteId: 'note-1', lexical: true, semantic: false }],
                semanticAvailable: false,
                semanticUsed: false,
                semanticError: null,
            },
        } as never);

        renderSearch();

        const input = await screen.findByRole('textbox', { name: 'Quick search notes' });
        fireEvent.change(input, { target: { value: 'alpha' } });

        await waitFor(
            () => {
                expect(searchApi.fetchSearchNotes).toHaveBeenCalledWith({
                    query: 'alpha',
                    limit: 5,
                    mode: 'lexical',
                });
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

    it('shows meaning matches in the sidebar and opens the same all-search when embedding is enabled', async () => {
        vi.mocked(fetchSearchAdminStatus).mockResolvedValue(createStatus(true));
        vi.mocked(searchApi.fetchSearchNotes).mockResolvedValue({
            type: 'success',
            searchNotes: {
                totalCount: 1,
                notes: [{ id: 'note-2', title: 'The note you were trying to remember' }],
                matches: [{ noteId: 'note-2', lexical: false, semantic: true }],
                semanticAvailable: true,
                semanticUsed: true,
                semanticError: null,
            },
        } as never);

        renderSearch();

        const input = await screen.findByRole('textbox', { name: 'Quick search notes' });
        fireEvent.change(input, { target: { value: 'a half remembered note' } });

        await waitFor(
            () => {
                expect(searchApi.fetchSearchNotes).toHaveBeenCalledWith({
                    query: 'a half remembered note',
                    limit: 5,
                    mode: 'hybrid',
                });
            },
            { timeout: 1_500 },
        );
        expect(await screen.findByText('The note you were trying to remember')).toBeInTheDocument();

        fireEvent.submit(input.closest('form') as HTMLFormElement);
        expect(mockNavigate).toHaveBeenCalledWith({
            to: SEARCH_ROUTE,
            search: {
                query: 'a half remembered note',
                page: 1,
                mode: 'hybrid',
            },
        });
    });

    it('keeps quick search lexical until the enabled meaning index is actually ready', async () => {
        vi.mocked(fetchSearchAdminStatus).mockResolvedValue(createStatus(true, false));
        vi.mocked(searchApi.fetchSearchNotes).mockResolvedValue({
            type: 'success',
            searchNotes: {
                totalCount: 0,
                notes: [],
                matches: [],
                semanticAvailable: false,
                semanticUsed: false,
                semanticError: null,
            },
        } as never);

        renderSearch();

        const input = await screen.findByRole('textbox', { name: 'Quick search notes' });
        expect(input).toHaveAttribute('placeholder', 'Search notes');
        fireEvent.change(input, { target: { value: 'not ready yet' } });

        await waitFor(() => {
            expect(searchApi.fetchSearchNotes).toHaveBeenCalledWith({
                query: 'not ready yet',
                limit: 5,
                mode: 'lexical',
            });
        });
    });
});
