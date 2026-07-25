import type { IResolvers } from '@graphql-tools/utils';
import { type HybridNoteSearchResult, type SearchMode, searchNotesHybrid } from '../hybrid-search.js';

type GraphqlSearchMode = 'HYBRID' | 'LEXICAL' | 'SEMANTIC';

interface SearchNotesResolverInput {
    query: string;
    mode?: GraphqlSearchMode;
    pagination: {
        limit: number;
        offset: number;
    };
}

type SearchNotes = (input: {
    query: string;
    limit: number;
    offset: number;
    mode: SearchMode;
}) => Promise<HybridNoteSearchResult>;

export const createSearchNotesResolver = (search: SearchNotes = searchNotesHybrid) => {
    return async (_: unknown, { query, pagination, mode = 'HYBRID' }: SearchNotesResolverInput) => {
        return search({
            query,
            limit: Math.min(50, Math.max(0, pagination.limit)),
            offset: Math.max(0, pagination.offset),
            mode: mode.toLowerCase() as SearchMode,
        });
    };
};

export const searchResolvers: IResolvers = {
    Query: {
        searchNotes: createSearchNotesResolver(),
    },
};
