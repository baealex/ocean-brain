// @vitest-environment node
import { queryKeys } from './query-key-factory';

describe('queryKeys.search', () => {
    it('normalizes search pagination defaults and surrounding whitespace', () => {
        expect(queryKeys.search.results({ query: '  흐릿한 기억  ' })).toEqual([
            'search',
            'results',
            {
                query: '흐릿한 기억',
                limit: 25,
                offset: 0,
                mode: 'hybrid',
            },
        ]);

        expect(queryKeys.search.results({ query: '흐릿한 기억', mode: 'semantic' })).not.toEqual(
            queryKeys.search.results({ query: '흐릿한 기억', mode: 'lexical' }),
        );
    });

    it('keeps search settings status separate from result pages', () => {
        expect(queryKeys.search.adminStatus()).toEqual(['search', 'admin-status']);
        expect(queryKeys.search.resultsAll()).toEqual(['search', 'results']);
    });
});
