import { gql } from '~/modules/graphql.js';

export const cacheType = gql`
    type Cache {
        id: ID!
        key: String!
        value: String!
    }
`;

export const cacheQuery = gql`
    type Query {
        allCaches: [Cache!]!
        cache(key: String!): Cache!
    }
`;

export const cacheMutation = gql`
    type Mutation {
        setCache(key: String, value: String): Cache!
        deleteCache(key: String!): Boolean!
    }
`;

export const cacheTypeDefs = `
    ${cacheType}
    ${cacheQuery}
    ${cacheMutation}
`;
