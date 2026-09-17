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
        excerpt: SearchNoteExcerpt
    }

    type SearchNoteExcerpt { text: String!, source: String!, start: Int!, end: Int! }

    type SearchRelatedNote {
        id: ID!
        title: String!
        reasons: [String!]!
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
        searchRelatedNotes(noteId: ID!, limit: Int = 5): [SearchRelatedNote!]!
    }
`;
