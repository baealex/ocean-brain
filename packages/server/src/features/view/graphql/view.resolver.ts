import { viewMutationResolvers } from './view.mutation.resolver.js';
import { viewQueryResolvers } from './view.query.resolver.js';

export const viewResolvers = {
    Query: viewQueryResolvers,
    Mutation: viewMutationResolvers,
};
