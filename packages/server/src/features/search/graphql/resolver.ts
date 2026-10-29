import type { IResolvers } from '@graphql-tools/utils';
import { buildNoteSearchExcerpt } from '~/features/note/services/search.js';
import type { WorkspaceScopeInput } from '~/features/workspace/scope.js';
import { type HybridNoteSearchResult, type SearchMode, searchNotesHybrid } from '../hybrid-search.js';
import { searchRelatedNotes } from '../related-notes.js';

type GraphqlSearchMode = 'HYBRID' | 'LEXICAL' | 'SEMANTIC';

interface SearchNotesResolverInput {
    scope?: WorkspaceScopeInput;
    query: string;
    mode?: GraphqlSearchMode;
    pagination: {
        limit: number;
        offset: number;
    };
}

interface SearchRelatedNotesResolverInput {
    scope?: WorkspaceScopeInput;
    noteId: string;
    limit?: number;
}

type SearchNotes = (input: {
    query: string;
    limit: number;
    offset: number;
    mode: SearchMode;
    scope?: WorkspaceScopeInput;
}) => Promise<HybridNoteSearchResult>;

type SearchRelatedNotes = (
    noteId: number,
    limit: number,
    scope?: WorkspaceScopeInput,
) => Promise<Awaited<ReturnType<typeof searchRelatedNotes>>>;

export const createSearchNotesResolver = (search: SearchNotes = searchNotesHybrid) => {
    return async (_: unknown, { query, pagination, mode = 'HYBRID', scope }: SearchNotesResolverInput) => {
        const result = await search({
            query,
            ...(scope ? { scope } : {}),
            limit: Math.min(50, Math.max(0, pagination.limit)),
            offset: Math.max(0, pagination.offset),
            mode: mode.toLowerCase() as SearchMode,
        });
        const notes = new Map(result.notes.map((note) => [note.id, note]));
        return {
            ...result,
            matches: result.matches.map((match) => {
                const note = notes.get(match.noteId);
                return { ...match, excerpt: match.lexical && note ? buildNoteSearchExcerpt(note, query) : null };
            }),
        };
    };
};

export const createSearchRelatedNotesResolver = (findRelatedNotes: SearchRelatedNotes = searchRelatedNotes) => {
    return async (_: unknown, { noteId, limit = 5, scope }: SearchRelatedNotesResolverInput) => {
        const numericNoteId = Number(noteId);

        if (!Number.isSafeInteger(numericNoteId) || numericNoteId <= 0) {
            return [];
        }

        return scope
            ? findRelatedNotes(numericNoteId, Math.min(5, Math.max(0, Number(limit))), scope)
            : findRelatedNotes(numericNoteId, Math.min(5, Math.max(0, Number(limit))));
    };
};

export const searchResolvers: IResolvers = {
    Query: {
        searchNotes: createSearchNotesResolver(),
        searchRelatedNotes: createSearchRelatedNotesResolver(),
    },
};
