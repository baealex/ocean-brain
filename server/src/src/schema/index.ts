import { makeExecutableSchema } from '@graphql-tools/schema';
import { noteResolvers, noteTypeDefs } from './note';
import { imageResolvers, imageTypeDefs } from './image';
import { tagResolvers, tagTypeDefs } from './tag';
import { placeholderResolvers, placeholderTypeDefs } from './placeholder';
import { cacheResolvers, cacheTypeDefs } from './cache';

const schema = makeExecutableSchema({
    typeDefs: [
        cacheTypeDefs,
        noteTypeDefs,
        imageTypeDefs,
        tagTypeDefs,
        placeholderTypeDefs
    ],
    resolvers: [
        cacheResolvers,
        noteResolvers,
        imageResolvers,
        tagResolvers,
        placeholderResolvers
    ]
});

export default schema;
