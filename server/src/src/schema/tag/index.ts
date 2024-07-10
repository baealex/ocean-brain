import type { IResolvers } from '@graphql-tools/utils';

import models, { type Tag } from '~/models';
import { gql } from '~/modules/graphql';

export const tagType = gql`
    type Tag {
        id: ID!
        name: String!
        createdAt: String!
        updatedAt: String!
        referenceCount: Int!
    }
`;

export const tagQuery = gql`
    type Query {
        allTags(query: String = "", offset: Int = 0, limit: Int = 20): [Tag!]!
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

export const tagResolvers: IResolvers = {
    Query: {
        allTags: async (_, { query = '', offset = 0, limit = 20 }) => {
            return models.tag.findMany({
                skip: offset,
                take: limit,
                where: {
                    name: { contains: query },
                    notes: { some: { createdAt: { gt: new Date(0) } } }
                },
                orderBy: { notes: { _count: 'desc' } }
            });
        }
    },
    Mutation: {
        createTag: async (_, { name }: Tag) => {
            return models.tag.create({ data: { name } });
        }
    },
    Tag: {
        referenceCount: async (tag: Tag) => {
            return models.note.count({ where: { tags: { some: { id: tag.id } } } });
        }
    }
};
