import type { IResolvers } from '@graphql-tools/utils';
import { placeholderFieldResolvers } from './placeholder.field.resolver.js';
import { placeholderMutationResolvers } from './placeholder.mutation.resolver.js';
import { placeholderQueryResolvers } from './placeholder.query.resolver.js';

export const placeholderResolvers: IResolvers = {
    Query: placeholderQueryResolvers,
    Mutation: placeholderMutationResolvers,
    Placeholder: placeholderFieldResolvers,
};
