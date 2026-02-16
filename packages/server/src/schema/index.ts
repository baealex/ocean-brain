import { makeExecutableSchema } from '@graphql-tools/schema';
import { noteResolvers, noteTypeDefs } from './note/index.js';
import { imageResolvers, imageTypeDefs } from './image/index.js';
import { tagResolvers, tagTypeDefs } from './tag/index.js';
import { placeholderResolvers, placeholderTypeDefs } from './placeholder/index.js';
import { cacheResolvers, cacheTypeDefs } from './cache/index.js';
import { reminderResolvers, reminderTypeDefs } from './reminder/index.js';

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
