import type { IResolvers } from '@graphql-tools/utils';

import models, { type Placeholder } from '~/models.js';
import { gql } from '~/modules/graphql.js';
import type { Pagination, SearchFilter } from '~/types/index.js';

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

export const placeholderResolvers: IResolvers = {
    Query: {
        allPlaceholders: async (_, { searchFilter, pagination }: { searchFilter?: SearchFilter; pagination?: Pagination }) => {
            const placeholders = await models.placeholder.findMany({
                where: searchFilter?.query ? { name: { contains: searchFilter.query } } : undefined,
                take: pagination?.limit,
                skip: pagination?.offset
            });

            const totalCount = await models.placeholder.count();

            return {
                totalCount,
                placeholders
            };
        },
        placeholder: async (_, { id }: { id: number }) => {
            return await models.placeholder.findFirst({ where: { id } });
        }
    },
    Mutation: {
        createPlaceholder: async (_, { name, template, replacement }: Placeholder) => {
            return await models.placeholder.create({
                data: {
                    name,
                    template,
                    replacement
                }
            });
        },
        updatePlaceholder: async (_, { id, name, template, replacement }: Placeholder) => {
            const placeholder = await models.placeholder.findFirst({ where: { id } });
            if (!placeholder) {
                throw new Error('Placeholder not found');
            }

            await models.placeholder.update({
                where: { id },
                data: {
                    name,
                    template,
                    replacement
                }
            });

            return placeholder;
        },
        deletePlaceholder: async (_, { id }: { id: number }) => {
            const placeholder = await models.placeholder.findFirst({ where: { id: Number(id) } });
            if (!placeholder) {
                return false;
            }

            await models.placeholder.delete({ where: { id: Number(id) } });
            return true;
        }
    }
};
