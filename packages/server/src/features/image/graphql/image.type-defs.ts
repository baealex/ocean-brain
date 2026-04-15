import { gql } from '~/modules/graphql.js';

export const imageTypeDefs = gql`
    input PaginationInput {
        limit: Int!
        offset: Int!
    }

    type Image {
        id: ID!
        url: String!
        referenceCount: Int!
    }

    type Images {
        totalCount: Int!
        images: [Image!]!
    }

    type Query {
        allImages(pagination: PaginationInput): Images!
        image(id: ID!): Image!
    }

    type Mutation {
        deleteImage(id: ID!): Boolean!
    }
`;
