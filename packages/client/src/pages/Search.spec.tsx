import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import * as searchApi from '~/apis/search.api';
import { fetchSearchAdminStatus } from '~/apis/search-admin.api';
import { createTestQueryClient } from '~/test/test-utils';
import Search from './Search';

const routeState = vi.hoisted(() => ({
    navigate: vi.fn(),
    search: {
        page: 1,
        query: '점쟁이 죽는',
        mode: 'hybrid' as const,
    },
}));

vi.mock('@tanstack/react-router', () => ({
    getRouteApi: () => ({
        useNavigate: () => routeState.navigate,
        useSearch: () => routeState.search,
    }),
    Link: ({ children, params }: { children: React.ReactNode; params?: { id?: string } }) => (
        <a href={params?.id ? `/${params.id}` : '/'}>{children}</a>
    ),
}));

vi.mock('~/apis/search.api', () => ({
    fetchSearchNotes: vi.fn(),
}));
vi.mock('~/apis/search-admin.api', () => ({
    fetchSearchAdminStatus: vi.fn(),
}));

const createStatus = (enabled: boolean) => ({
    config: {
        enabled,
        baseUrl: enabled ? 'http://127.0.0.1:1234/v1' : '',
        model: enabled ? 'text-embedding-qwen' : '',
        queryInstruction: '',
    },
    phase: enabled ? ('ready' as const) : ('disabled' as const),
    available: enabled,
    needsReindex: false,
    noteCount: enabled ? 1 : 0,
    chunkCount: enabled ? 1 : 0,
    indexedAt: enabled ? '2026-01-01T00:00:00.000Z' : null,
    dimensions: enabled ? 1024 : null,
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
            query: '점쟁이 죽는',
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
                        title: '그날 들은 불길한 이야기',
                        content: JSON.stringify([
                            {
                                type: 'paragraph',
                                content: [{ type: 'text', text: '늦은 시간에 오락실을 돌아다녔다.' }],
                            },
                            {
                                type: 'paragraph',
                                content: [{ type: 'text', text: '누군가 내 귀에 6년 안에 죽는 거라고 속삭였다.' }],
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
        expect(screen.getByRole('link', { name: '그날 들은 불길한 이야기' })).toHaveAttribute('href', '/17');
        expect(screen.getByText(/6년 안에 죽는 거라고/)).toBeInTheDocument();
        expect(screen.queryByText(/늦은 시간에 오락실/)).not.toBeInTheDocument();
        expect(searchApi.fetchSearchNotes).toHaveBeenCalledWith({
            query: '점쟁이 죽는',
            limit: 10,
            offset: 0,
            mode: 'hybrid',
        });
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
        await user.click(await screen.findByRole('radio', { name: 'Keywords' }));

        expect(routeState.navigate).toHaveBeenCalledWith({
            search: {
                query: '점쟁이 죽는',
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
                query: '점쟁이 죽는',
                limit: 10,
                offset: 0,
                mode: 'lexical',
            });
        });
        expect(screen.queryByRole('radiogroup', { name: 'Search method' })).not.toBeInTheDocument();
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
});
