import type { Note } from '~/models/note.model';
import { graphQuery } from '~/modules/graph-query';

export interface FetchSearchNotesParams {
    query: string;
    limit?: number;
    offset?: number;
}

export type SearchNote = Pick<Note, 'id' | 'title' | 'content' | 'pinned' | 'tags' | 'createdAt' | 'updatedAt'>;

export interface SearchNotesResult {
    totalCount: number;
    notes: SearchNote[];
    semanticAvailable: boolean;
    semanticUsed: boolean;
    semanticError: string | null;
}

export function fetchSearchNotes({ query, limit = 25, offset = 0 }: FetchSearchNotesParams) {
    return graphQuery<
        { searchNotes: SearchNotesResult },
        {
            query: string;
            pagination: {
                limit: number;
                offset: number;
            };
        }
    >(
        `query FetchSearchNotes($query: String!, $pagination: PaginationInput!) {
            searchNotes(query: $query, pagination: $pagination) {
                totalCount
                semanticAvailable
                semanticUsed
                semanticError
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
            pagination: {
                limit,
                offset,
            },
        },
    );
}
