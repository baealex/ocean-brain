import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import * as searchApi from '~/apis/search.api';
import { fetchSearchAdminStatus } from '~/apis/search-admin.api';
import { SETTINGS_SEARCH_ROUTE } from '~/modules/url';
import { createTestQueryClient } from '~/test/test-utils';
import Search from './Search';

const routeState = vi.hoisted(() => ({
    navigate: vi.fn(),
    search: {
        page: 1,
        query: 'fortune teller death',
        mode: 'hybrid' as const,
    },
}));

vi.mock('@tanstack/react-router', () => ({
    getRouteApi: () => ({
        useNavigate: () => routeState.navigate,
        useSearch: () => routeState.search,
    }),
    Link: ({ children, params, to }: { children: React.ReactNode; params?: { id?: string }; to?: string }) => (
        <a href={params?.id ? `/${params.id}` : (to ?? '/')}>{children}</a>
    ),
}));

vi.mock('~/apis/search.api', () => ({
    fetchSearchNotes: vi.fn(),
    fetchSearchRelatedNotes: vi.fn(),
}));
vi.mock('~/apis/search-admin.api', () => ({
    fetchSearchAdminStatus: vi.fn(),
}));

beforeAll(() => {
    Object.defineProperties(HTMLElement.prototype, {
        hasPointerCapture: { configurable: true, value: () => false },
        setPointerCapture: { configurable: true, value: () => undefined },
        releasePointerCapture: { configurable: true, value: () => undefined },
        scrollIntoView: { configurable: true, value: () => undefined },
    });
});

const createStatus = (enabled: boolean, available = enabled) => ({
    config: {
        enabled,
        baseUrl: enabled ? 'http://127.0.0.1:1234/v1' : '',
        model: enabled ? 'text-embedding-qwen' : '',
        queryInstruction: '',
    },
    connectionValidated: enabled,
    apiKeyConfigured: false,
    phase: enabled ? (available ? ('ready' as const) : ('needs-index' as const)) : ('disabled' as const),
    available,
    needsReindex: false,
    noteCount: enabled ? 1 : 0,
    chunkCount: enabled ? 1 : 0,
    indexedAt: enabled ? '2026-01-01T00:00:00.000Z' : null,
    dimensions: enabled ? 1024 : null,
    pendingNoteCount: 0,
    lastSyncedAt: enabled ? '2026-01-01T00:00:00.000Z' : null,
    syncError: null,
    progress: null,
    error: null,
});

const renderPage = () => {
    render(
        <QueryClientProvider client={createTestQueryClient()}>
            <Search />
        </QueryClientProvider>,
    );
};

describe('<Search />', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        routeState.search = {
            page: 1,
            query: 'fortune teller death',
            mode: 'hybrid',
        };
        vi.mocked(fetchSearchAdminStatus).mockResolvedValue(createStatus(true));
    });

    it('shows a meaning-only result even when the literal query is absent', async () => {
        vi.mocked(searchApi.fetchSearchNotes).mockResolvedValue({
            type: 'success',
            searchNotes: {
                totalCount: 1,
                semanticAvailable: true,
                semanticUsed: true,
                semanticError: null,
                matches: [{ noteId: '17', lexical: false, semantic: true }],
                notes: [
                    {
                        id: '17',
                        title: 'The ominous story I heard that day',
                        content: JSON.stringify([
                            {
                                type: 'paragraph',
                                content: [{ type: 'text', text: 'I wandered around the arcade late at night.' }],
                            },
                            {
                                type: 'paragraph',
                                content: [
                                    {
                                        type: 'text',
                                        text: 'A fortune teller warned me about death within six years.',
                                    },
                                ],
                            },
                        ]),
                        pinned: false,
                        tags: [],
                        createdAt: '2026-01-01T00:00:00.000Z',
                        updatedAt: '2026-01-01T00:00:00.000Z',
                    },
                ],
            },
        });

        renderPage();

        expect(await screen.findByText('Meaning match')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'The ominous story I heard that day' })).toHaveAttribute('href', '/17');
        expect(screen.getByText(/death within six years/)).toBeInTheDocument();
        expect(screen.queryByText(/wandered around the arcade/)).not.toBeInTheDocument();
        expect(searchApi.fetchSearchNotes).toHaveBeenCalledWith({
            query: 'fortune teller death',
            limit: 10,
            offset: 0,
            mode: 'hybrid',
        });
    });

    it('loads related notes only when a result asks to explore them', async () => {
        const user = userEvent.setup();
        vi.mocked(searchApi.fetchSearchNotes).mockResolvedValue({
            type: 'success',
            searchNotes: {
                totalCount: 1,
                semanticAvailable: true,
                semanticUsed: false,
                semanticError: null,
                matches: [{ noteId: '17', lexical: true, semantic: false }],
                notes: [
                    {
                        id: '17',
                        title: 'Current project note',
                        content: '[]',
                        pinned: false,
                        tags: [],
                        createdAt: '2026-01-01T00:00:00.000Z',
                        updatedAt: '2026-01-01T00:00:00.000Z',
                    },
                ],
            },
        });
        vi.mocked(searchApi.fetchSearchRelatedNotes).mockResolvedValue({
            type: 'success',
            searchRelatedNotes: [
                {
                    id: '42',
                    title: 'Older project decision',
                    reasons: ['Backlink to this note', 'Shares @project'],
                },
            ],
        });

        renderPage();

        expect(searchApi.fetchSearchRelatedNotes).not.toHaveBeenCalled();
        await user.click(await screen.findByText('Related notes'));

        expect(await screen.findByRole('link', { name: /Older project decision/ })).toHaveAttribute('href', '/42');
        expect(screen.getByText(/Backlink to this note/)).toBeInTheDocument();
        expect(screen.getByText(/Shares @project/)).toBeInTheDocument();
        expect(searchApi.fetchSearchRelatedNotes).toHaveBeenCalledWith('17');
    });

    it('makes a semantic API failure visible while keeping keyword results', async () => {
        vi.mocked(searchApi.fetchSearchNotes).mockResolvedValue({
            type: 'success',
            searchNotes: {
                totalCount: 0,
                notes: [],
                matches: [],
                semanticAvailable: true,
                semanticUsed: false,
                semanticError: 'Embedding API timed out.',
            },
        });

        renderPage();

        expect(await screen.findByText(/results use keyword search only/i)).toBeInTheDocument();
    });

    it('puts the selected search method in the route', async () => {
        const user = userEvent.setup();
        vi.mocked(searchApi.fetchSearchNotes).mockResolvedValue({
            type: 'success',
            searchNotes: {
                totalCount: 0,
                notes: [],
                matches: [],
                semanticAvailable: true,
                semanticUsed: true,
                semanticError: null,
            },
        });

        renderPage();
        await user.click(await screen.findByRole('combobox', { name: 'Search mode' }));
        await user.click(await screen.findByRole('option', { name: 'Keyword only' }));

        expect(routeState.navigate).toHaveBeenCalledWith({
            search: {
                query: 'fortune teller death',
                page: 1,
                mode: 'lexical',
            },
        });
    });

    it('keeps the common search page lexical when embedding is not configured', async () => {
        vi.mocked(fetchSearchAdminStatus).mockResolvedValue(createStatus(false));
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
        });

        renderPage();

        await waitFor(() => {
            expect(searchApi.fetchSearchNotes).toHaveBeenCalledWith({
                query: 'fortune teller death',
                limit: 10,
                offset: 0,
                mode: 'lexical',
            });
        });
        expect(screen.getByRole('searchbox', { name: 'Search notes' })).toHaveAttribute(
            'placeholder',
            'Search notes by keyword',
        );
        expect(screen.queryByRole('radiogroup', { name: 'Search method' })).not.toBeInTheDocument();
    });

    it('keeps the common search page lexical while the semantic index is unavailable', async () => {
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
        });

        renderPage();

        await waitFor(() => {
            expect(searchApi.fetchSearchNotes).toHaveBeenCalledWith({
                query: 'fortune teller death',
                limit: 10,
                offset: 0,
                mode: 'lexical',
            });
        });
        expect(screen.getByRole('searchbox', { name: 'Search notes' })).toHaveAttribute(
            'placeholder',
            'Search notes by keyword',
        );
        expect(screen.queryByRole('radiogroup', { name: 'Search method' })).not.toBeInTheDocument();
    });

    it('shows a concise meaning-search hint on the empty search page', async () => {
        vi.mocked(fetchSearchAdminStatus).mockResolvedValue(createStatus(false));
        routeState.search = {
            page: 1,
            query: '',
            mode: 'hybrid',
        };

        renderPage();

        expect(await screen.findByText(/Search by meaning when the exact words are fuzzy/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Enable meaning search' })).toHaveAttribute(
            'href',
            SETTINGS_SEARCH_ROUTE,
        );
    });

    it('focuses the common search input when opened without a query', async () => {
        const user = userEvent.setup();
        routeState.search = {
            page: 1,
            query: '',
            mode: 'hybrid',
        };

        renderPage();

        const input = await screen.findByRole('searchbox', { name: 'Search notes' });
        const searchButton = screen.getByRole('button', { name: 'Search' });

        expect(input).toHaveFocus();
        expect(searchButton).toBeDisabled();

        await user.type(input, 'ocean memory');
        await user.click(searchButton);

        expect(routeState.navigate).toHaveBeenCalledWith({
            search: {
                query: 'ocean memory',
                page: 1,
                mode: 'hybrid',
            },
        });
    });

    it('searches automatically after the user pauses typing', async () => {
        const user = userEvent.setup();
        routeState.search = {
            page: 1,
            query: '',
            mode: 'hybrid',
        };

        renderPage();

        const input = await screen.findByRole('searchbox', { name: 'Search notes' });
        await user.type(input, 'half remembered meeting');

        expect(routeState.navigate).not.toHaveBeenCalled();
        await waitFor(
            () => {
                expect(routeState.navigate).toHaveBeenCalledWith({
                    search: {
                        query: 'half remembered meeting',
                        page: 1,
                        mode: 'hybrid',
                    },
                    replace: true,
                });
            },
            { timeout: 1_000 },
        );
    });

    it('waits for text composition to finish before starting the debounce', async () => {
        const user = userEvent.setup();
        routeState.search = {
            page: 1,
            query: '',
            mode: 'hybrid',
        };

        renderPage();

        const input = await screen.findByRole('searchbox', { name: 'Search notes' });
        fireEvent.compositionStart(input);
        await user.type(input, 'composing text');
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(routeState.navigate).not.toHaveBeenCalled();
        fireEvent.compositionEnd(input);
        await waitFor(
            () => {
                expect(routeState.navigate).toHaveBeenCalledWith({
                    search: {
                        query: 'composing text',
                        page: 1,
                        mode: 'hybrid',
                    },
                    replace: true,
                });
            },
            { timeout: 1_000 },
        );
    });
});
