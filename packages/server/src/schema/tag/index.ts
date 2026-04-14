import type { IResolvers } from '@graphql-tools/utils';

import models, { type Tag, type Prisma } from '~/models.js';
import { gql } from '~/modules/graphql.js';
import { ensureTagByName } from '~/modules/tag-organization.js';
import type { Pagination, SearchFilter } from '~/types/index.js';

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

export const createTagMutationResolver = (
    ensureTag = ensureTagByName
) => {
    return async (_: unknown, { name }: { name: string }) => {
        const result = await ensureTag(name);

        return result.tag;
    };
};

type TagReferenceCountSource = Pick<Tag, 'id'> | {
    id: string;
};

export const tagResolvers: IResolvers = {
    Query: {
        allTags: async (_, {
            searchFilter,
            pagination
        }: {
            searchFilter: SearchFilter;
            pagination: Pagination;
        }) => {
            const where: Prisma.TagWhereInput = {
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
    Mutation: { createTag: createTagMutationResolver() },
    Tag: {
        referenceCount: async (tag: TagReferenceCountSource) => {
            return models.note.count({ where: { tags: { some: { id: Number(tag.id) } } } });
        }
    }
};
