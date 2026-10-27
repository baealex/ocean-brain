import { legacyViewResolvers } from './view.compat.js';
import { viewMutationResolvers } from './view.mutation.resolver.js';
import { viewQueryResolvers } from './view.query.resolver.js';

export const viewResolvers = {
    ...legacyViewResolvers,
    Query: { ...legacyViewResolvers.Query, ...viewQueryResolvers },
    Mutation: { ...legacyViewResolvers.Mutation, ...viewMutationResolvers },
};
