import type { IResolvers } from '@graphql-tools/utils';

import { cacheFieldResolvers } from './cache.field.resolver.js';
import { cacheMutationResolvers } from './cache.mutation.resolver.js';
import { cacheQueryResolvers } from './cache.query.resolver.js';

export const cacheResolvers: IResolvers = {
    Cache: cacheFieldResolvers,
    Query: cacheQueryResolvers,
    Mutation: cacheMutationResolvers,
};
