import { makeExecutableSchema } from '@graphql-tools/schema';
import { noteResolvers, noteTypeDefs } from './note';
import { imageResolvers, imageTypeDefs } from './image';
import { tagResolvers, tagTypeDefs } from './tag';
import { placeholderResolvers, placeholderTypeDefs } from './placeholder';
import { cacheResolvers, cacheTypeDefs } from './cache';
import { reminderResolvers, reminderTypeDefs } from './reminder';

const schema = makeExecutableSchema({
    typeDefs: [
        cacheTypeDefs,
        noteTypeDefs,
        imageTypeDefs,
        tagTypeDefs,
        placeholderTypeDefs,
        reminderTypeDefs
    ],
    resolvers: [
        cacheResolvers,
        noteResolvers,
        imageResolvers,
        tagResolvers,
        placeholderResolvers,
        reminderResolvers
    ]
});

export default schema;
