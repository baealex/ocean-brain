import type { IResolvers } from '@graphql-tools/utils';
import { type HybridNoteSearchResult, searchNotesHybrid } from '../hybrid-search.js';

interface SearchNotesResolverInput {
    query: string;
    pagination: {
        limit: number;
        offset: number;
    };
}

type SearchNotes = (input: { query: string; limit: number; offset: number }) => Promise<HybridNoteSearchResult>;

export const createSearchNotesResolver = (search: SearchNotes = searchNotesHybrid) => {
    return async (_: unknown, { query, pagination }: SearchNotesResolverInput) => {
        return search({
            query,
            limit: Math.min(50, Math.max(0, pagination.limit)),
            offset: Math.max(0, pagination.offset),
        });
    };
};

export const searchResolvers: IResolvers = {
    Query: {
        searchNotes: createSearchNotesResolver(),
    },
};
