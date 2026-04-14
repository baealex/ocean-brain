import type { IResolvers } from '@graphql-tools/utils';
import { tagFieldResolvers } from './tag.field.resolver.js';
import { tagMutationResolvers } from './tag.mutation.resolver.js';
import { tagQueryResolvers } from './tag.query.resolver.js';

export const tagResolvers: IResolvers = {
    Query: tagQueryResolvers,
    Mutation: tagMutationResolvers,
    Tag: tagFieldResolvers,
};
