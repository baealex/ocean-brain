import { makeExecutableSchema } from '@graphql-tools/schema';
import { noteResolvers, noteTypeDefs } from './note';
import { imageResolvers, imageTypeDefs } from './image';
import { tagResolvers, tagTypeDefs } from './tag';
import { placeholderResolvers, placeholderTypeDefs } from './placeholder';

const schema = makeExecutableSchema({
    typeDefs: [
        noteTypeDefs,
        imageTypeDefs,
        tagTypeDefs,
        placeholderTypeDefs
    ],
    resolvers: [
        noteResolvers,
        imageResolvers,
        tagResolvers,
        placeholderResolvers
    ]
});

export default schema;
