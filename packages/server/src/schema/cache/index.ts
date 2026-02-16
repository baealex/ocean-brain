import type { IResolvers } from '@graphql-tools/utils';

import models, { type Cache } from '~/models.js';
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

export const cacheResolvers: IResolvers = {
    Query: {
        allCaches: models.cache.findMany,
        cache: (_, { key }: Cache) => models.cache.findUnique({ where: { key } })
    },
    Mutation: {
        setCache: async (_, { key, value }: Cache) => {
            const cache = await models.cache.findFirst({ where: { key } });
            if (cache) {
                return models.cache.update({
                    where: { key },
                    data: { value: decodeURIComponent(value) }
                });
            }
            return models.cache.create({
                data: {
                    key,
                    value: decodeURIComponent(value)
                }
            });
        },
        deleteCache: (_, { key }: Cache) => models.cache.delete({ where: { key } }).then(() => true)
    }
};
