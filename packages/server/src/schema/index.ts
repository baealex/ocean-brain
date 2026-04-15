import { makeExecutableSchema } from '@graphql-tools/schema';
import { cacheResolvers, cacheTypeDefs } from '../features/cache/graphql/index.js';
import { imageResolvers, imageTypeDefs } from '../features/image/graphql/index.js';
import { noteResolvers, noteTypeDefs } from '../features/note/graphql/index.js';
import { placeholderResolvers, placeholderTypeDefs } from '../features/placeholder/graphql/index.js';
import { reminderResolvers, reminderTypeDefs } from '../features/reminder/graphql/index.js';
import { tagResolvers, tagTypeDefs } from '../features/tag/graphql/index.js';
import { viewResolvers, viewTypeDefs } from '../features/view/graphql/index.js';

const schema = makeExecutableSchema({
    typeDefs: [
        cacheTypeDefs,
        noteTypeDefs,
        imageTypeDefs,
        tagTypeDefs,
        placeholderTypeDefs,
        reminderTypeDefs,
        viewTypeDefs,
    ],
    resolvers: [
        cacheResolvers,
        noteResolvers,
        imageResolvers,
        tagResolvers,
        placeholderResolvers,
        reminderResolvers,
        viewResolvers,
    ],
});

export default schema;
