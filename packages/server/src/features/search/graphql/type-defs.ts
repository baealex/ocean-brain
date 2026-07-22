import { gql } from '~/modules/graphql.js';

export const searchTypeDefs = gql`
    enum SearchMode {
        HYBRID
        LEXICAL
        SEMANTIC
    }

    type SearchNoteMatch {
        noteId: ID!
        lexical: Boolean!
        semantic: Boolean!
    }

    type SearchNotesResult {
        totalCount: Int!
        notes: [Note!]!
        matches: [SearchNoteMatch!]!
        semanticAvailable: Boolean!
        semanticUsed: Boolean!
        semanticError: String
    }

    extend type Query {
        searchNotes(query: String!, pagination: PaginationInput!, mode: SearchMode = HYBRID): SearchNotesResult!
    }
`;
