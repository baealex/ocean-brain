import { makeExecutableSchema } from '@graphql-tools/schema';
import { imageResolvers, imageTypeDefs } from '../features/image/graphql/index.js';
import { noteResolvers, noteTypeDefs } from '../features/note/graphql/index.js';
import { reminderResolvers, reminderTypeDefs } from '../features/reminder/graphql/index.js';
import { tagResolvers, tagTypeDefs } from '../features/tag/graphql/index.js';
import { cacheResolvers, cacheTypeDefs } from './cache/index.js';
import { placeholderResolvers, placeholderTypeDefs } from './placeholder/index.js';

const schema = makeExecutableSchema({
    typeDefs: [cacheTypeDefs, noteTypeDefs, imageTypeDefs, tagTypeDefs, placeholderTypeDefs, reminderTypeDefs],
    resolvers: [cacheResolvers, noteResolvers, imageResolvers, tagResolvers, placeholderResolvers, reminderResolvers],
});

export default schema;
