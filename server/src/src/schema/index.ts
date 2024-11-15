import { makeExecutableSchema } from '@graphql-tools/schema';
import { noteResolvers, noteTypeDefs } from './note';
import { imageResolvers, imageTypeDefs } from './image';
import { tagResolvers, tagTypeDefs } from './tag';

const schema = makeExecutableSchema({
    typeDefs: [
        noteTypeDefs,
        imageTypeDefs,
        tagTypeDefs
    ],
    resolvers: [
        noteResolvers,
        imageResolvers,
        tagResolvers
    ]
});

export default schema;
