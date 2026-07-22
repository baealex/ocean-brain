import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import * as searchApi from '~/apis/search.api';
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
        await user.click(screen.getByRole('radio', { name: 'Keywords' }));

        expect(routeState.navigate).toHaveBeenCalledWith({
            search: {
                query: '점쟁이 죽는',
                page: 1,
                mode: 'lexical',
            },
        });
    });
});
