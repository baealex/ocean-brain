import type { IResolvers } from '@graphql-tools/utils';
import { imageFieldResolvers } from './image.field.resolver.js';
import { imageMutationResolvers } from './image.mutation.resolver.js';
import { imageQueryResolvers } from './image.query.resolver.js';

export const imageResolvers: IResolvers = {
    Query: imageQueryResolvers,
    Mutation: imageMutationResolvers,
    Image: imageFieldResolvers,
};
