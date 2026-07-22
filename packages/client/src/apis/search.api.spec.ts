// @vitest-environment node
import { fetchSearchNotes } from '~/apis/search.api';
import { graphQuery } from '~/modules/graph-query';

vi.mock('~/modules/graph-query', () => ({ graphQuery: vi.fn() }));

describe('search.api', () => {
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

        await fetchSearchNotes({ query: '점쟁이 죽는', limit: 10, offset: 20, mode: 'semantic' });

        const [query, variables] = vi.mocked(graphQuery).mock.calls[0];
        expect(query).toContain('query FetchSearchNotes');
        expect(query).toContain('semanticUsed');
        expect(query).toContain('matches');
        expect(query).toContain('content');
        expect(query).not.toContain('점쟁이 죽는');
        expect(variables).toEqual({
            query: '점쟁이 죽는',
            mode: 'SEMANTIC',
            pagination: {
                limit: 10,
                offset: 20,
            },
        });
    });
});
