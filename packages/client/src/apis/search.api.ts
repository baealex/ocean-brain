import type { Note } from '~/models/note.model';
import type { WorkspaceScope } from '~/models/workspace.model';
import { graphQuery } from '~/modules/graph-query';

export type SearchMode = 'hybrid' | 'lexical' | 'semantic';

export interface FetchSearchNotesParams {
    scope?: WorkspaceScope;
    query: string;
    limit?: number;
    offset?: number;
    mode?: SearchMode;
}

export type SearchNote = Pick<
    Note,
    'workspaceId' | 'id' | 'title' | 'content' | 'pinned' | 'tags' | 'createdAt' | 'updatedAt'
>;

export interface SearchNoteMatch {
    noteId: string;
    lexical: boolean;
    semantic: boolean;
}

export interface SearchRelatedNote {
    id: string;
    title: string;
    reasons: string[];
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

export function fetchSearchNotes({ query, limit = 25, offset = 0, mode = 'hybrid', scope }: FetchSearchNotesParams) {
    return graphQuery<
        { searchNotes: SearchNotesResult },
        {
            scope?: WorkspaceScope;
            query: string;
            mode: (typeof graphqlSearchModes)[SearchMode];
            pagination: {
                limit: number;
                offset: number;
            };
        }
    >(
        `query FetchSearchNotes($query: String!, $pagination: PaginationInput!, $mode: SearchMode!, $scope: WorkspaceScopeInput) {
            searchNotes(query: $query, pagination: $pagination, mode: $mode, scope: $scope) {
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
                    workspaceId
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
            ...(scope ? { scope } : {}),
            query,
            mode: graphqlSearchModes[mode],
            pagination: {
                limit,
                offset,
            },
        },
    );
}

export function fetchSearchRelatedNotes(noteId: string, limit = 5, scope?: WorkspaceScope) {
    return graphQuery<
        { searchRelatedNotes: SearchRelatedNote[] },
        {
            noteId: string;
            limit: number;
            scope?: WorkspaceScope;
        }
    >(
        `query FetchSearchRelatedNotes($noteId: ID!, $limit: Int!, $scope: WorkspaceScopeInput) {
            searchRelatedNotes(noteId: $noteId, limit: $limit, scope: $scope) {
                id
                title
                reasons
            }
        }`,
        { noteId, limit, ...(scope ? { scope } : {}) },
    );
}
