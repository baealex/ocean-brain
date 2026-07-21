import { gql } from '~/modules/graphql.js';

export const searchTypeDefs = gql`
    type SearchNotesResult {
        totalCount: Int!
        notes: [Note!]!
        semanticAvailable: Boolean!
        semanticUsed: Boolean!
        semanticError: String
    }

    extend type Query {
        searchNotes(query: String!, pagination: PaginationInput!): SearchNotesResult!
    }
`;
