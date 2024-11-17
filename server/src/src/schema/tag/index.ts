import type { IResolvers } from '@graphql-tools/utils';

import models, { type Tag } from '~/models';
import { gql } from '~/modules/graphql';
import type { Pagination, SearchFilter } from '~/types';

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

export const tagResolvers: IResolvers = {
    Query: {
        allTags: async (_, {
            searchFilter,
            pagination
        }: {
            searchFilter: SearchFilter;
            pagination: Pagination;
        }) => {
            const where: Parameters<typeof models.tag.findMany>[0]['where'] = {
                name: { contains: searchFilter.query },
                NOT: { notes: { none: { } } }
            };
            const $tags = models.tag.findMany({
                skip: pagination.offset,
                take: pagination.limit,
                where,
                orderBy: { notes: { _count: 'desc' } }
            });

            return {
                totalCount: await models.tag.count({ where }),
                tags: await $tags
            };
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
