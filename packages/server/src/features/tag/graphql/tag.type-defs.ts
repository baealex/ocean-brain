import { gql } from '~/modules/graphql.js';

export const tagType = gql`
    input PaginationInput {
        limit: Int!
        offset: Int!
    }

    input SearchFilterInput {
        query: String!
    }

    type Tag {
        id: ID!
        name: String!
        createdAt: String!
        updatedAt: String!
        referenceCount: Int!
    }

    type Tags {
        totalCount: Int!
        tags: [Tag!]!
    }
`;

export const tagQuery = gql`
    type Query {
        allTags(searchFilter: SearchFilterInput, pagination: PaginationInput): Tags!
    }
`;

export const tagMutation = gql`
    type Mutation {
        createTag(name: String!): Tag!
    }
`;

export const tagTypeDefs = `
    ${tagType}
    ${tagQuery}
    ${tagMutation}
`;
