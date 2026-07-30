import type { IResolvers } from '@graphql-tools/utils';
import { type HybridNoteSearchResult, type SearchMode, searchNotesHybrid } from '../hybrid-search.js';
import { searchRelatedNotes } from '../related-notes.js';

type GraphqlSearchMode = 'HYBRID' | 'LEXICAL' | 'SEMANTIC';

interface SearchNotesResolverInput {
    query: string;
    mode?: GraphqlSearchMode;
    pagination: {
        limit: number;
        offset: number;
    };
}

interface SearchRelatedNotesResolverInput {
    noteId: string;
    limit?: number;
}

type SearchNotes = (input: {
    query: string;
    limit: number;
    offset: number;
    mode: SearchMode;
}) => Promise<HybridNoteSearchResult>;

type SearchRelatedNotes = (noteId: number, limit: number) => Promise<Awaited<ReturnType<typeof searchRelatedNotes>>>;

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

export const createSearchRelatedNotesResolver = (findRelatedNotes: SearchRelatedNotes = searchRelatedNotes) => {
    return async (_: unknown, { noteId, limit = 5 }: SearchRelatedNotesResolverInput) => {
        const numericNoteId = Number(noteId);

        if (!Number.isSafeInteger(numericNoteId) || numericNoteId <= 0) {
            return [];
        }

        return findRelatedNotes(numericNoteId, Math.min(5, Math.max(0, Number(limit))));
    };
};

export const searchResolvers: IResolvers = {
    Query: {
        searchNotes: createSearchNotesResolver(),
        searchRelatedNotes: createSearchRelatedNotesResolver(),
    },
};
