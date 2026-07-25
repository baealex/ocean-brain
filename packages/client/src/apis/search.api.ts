import type { Note } from '~/models/note.model';
import { graphQuery } from '~/modules/graph-query';

export type SearchMode = 'hybrid' | 'lexical' | 'semantic';

export interface FetchSearchNotesParams {
    query: string;
    limit?: number;
    offset?: number;
    mode?: SearchMode;
}

export type SearchNote = Pick<Note, 'id' | 'title' | 'content' | 'pinned' | 'tags' | 'createdAt' | 'updatedAt'>;

export interface SearchNoteMatch {
    noteId: string;
    lexical: boolean;
    semantic: boolean;
}

export interface SearchNotesResult {
    totalCount: number;
    notes: SearchNote[];
    matches: SearchNoteMatch[];
    semanticAvailable: boolean;
    semanticUsed: boolean;
    semanticError: string | null;
}

const graphqlSearchModes = {
    hybrid: 'HYBRID',
    lexical: 'LEXICAL',
    semantic: 'SEMANTIC',
} as const;

export function fetchSearchNotes({ query, limit = 25, offset = 0, mode = 'hybrid' }: FetchSearchNotesParams) {
    return graphQuery<
        { searchNotes: SearchNotesResult },
        {
            query: string;
            mode: (typeof graphqlSearchModes)[SearchMode];
            pagination: {
                limit: number;
                offset: number;
            };
        }
    >(
        `query FetchSearchNotes($query: String!, $pagination: PaginationInput!, $mode: SearchMode!) {
            searchNotes(query: $query, pagination: $pagination, mode: $mode) {
                totalCount
                semanticAvailable
                semanticUsed
                semanticError
                matches {
                    noteId
                    lexical
                    semantic
                }
                notes {
                    id
                    title
                    content
                    pinned
                    tags {
                        id
                        name
                    }
                    createdAt
                    updatedAt
                }
            }
        }`,
        {
            query,
            mode: graphqlSearchModes[mode],
            pagination: {
                limit,
                offset,
            },
        },
    );
}
