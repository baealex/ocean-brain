import { gql } from '~/modules/graphql.js';

export const placeholderType = gql`
    input PaginationInput {
        limit: Int!
        offset: Int!
    }

    input SearchFilterInput {
        query: String!
    }

    type Placeholder {
        id: ID!
        name: String!
        template: String!
        replacement: String!
        createdAt: String!
        updatedAt: String!
    }

    type Placeholders {
        totalCount: Int!
        placeholders: [Placeholder!]!
    }
`;

export const placeholderQuery = gql`
    type Query {
        allPlaceholders(searchFilter: SearchFilterInput, pagination: PaginationInput): Placeholders!
        placeholder(id: ID!): Placeholder
    }
`;

export const placeholderMutation = gql`
    type Mutation {
        createPlaceholder(name: String!, template: String!, replacement: String): Placeholder!
        updatePlaceholder(id: ID!, name: String, template: String, replacement: String): Placeholder!
        deletePlaceholder(id: ID!): Boolean!
    }
`;

export const placeholderTypeDefs = `
    ${placeholderType}
    ${placeholderQuery}
    ${placeholderMutation}
`;
