// @vitest-environment node
import { fetchSearchNotes, fetchSearchRelatedNotes } from '~/apis/search.api';
import { graphQuery } from '~/modules/graph-query';

vi.mock('~/modules/graph-query', () => ({ graphQuery: vi.fn() }));

describe('search.api', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sends search text and pagination through GraphQL variables', async () => {
        vi.mocked(graphQuery).mockResolvedValue({
            type: 'success',
            searchNotes: {
                totalCount: 0,
                notes: [],
                matches: [],
                semanticAvailable: true,
                semanticUsed: true,
                semanticError: null,
            },
        } as never);

        await fetchSearchNotes({ query: 'fortune teller death', limit: 10, offset: 20, mode: 'semantic' });

        const [query, variables] = vi.mocked(graphQuery).mock.calls.at(-1) ?? [];
        expect(query).toContain('query FetchSearchNotes');
        expect(query).toContain('semanticUsed');
        expect(query).toContain('matches');
        expect(query).toContain('content');
        expect(query).not.toContain('fortune teller death');
        expect(variables).toEqual({
            query: 'fortune teller death',
            mode: 'SEMANTIC',
            pagination: {
                limit: 10,
                offset: 20,
            },
        });
    });

    it('fetches related notes for a selected search result', async () => {
        vi.mocked(graphQuery).mockResolvedValue({
            type: 'success',
            searchRelatedNotes: [],
        } as never);

        await fetchSearchRelatedNotes('17', 3);

        const [query, variables] = vi.mocked(graphQuery).mock.calls.at(-1) ?? [];
        expect(query).toContain('query FetchSearchRelatedNotes');
        expect(query).toContain('reasons');
        expect(variables).toEqual({ noteId: '17', limit: 3 });
    });
});
