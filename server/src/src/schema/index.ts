import { makeExecutableSchema } from '@graphql-tools/schema';
import { userResolvers, userTypeDefs } from './user';
import { noteResolvers, noteTypeDefs } from './note';
import { imageResolvers, imageTypeDefs } from './image';
import { tagResolvers, tagTypeDefs } from './tag';

const schema = makeExecutableSchema({
    typeDefs: [
        userTypeDefs,
        noteTypeDefs,
        imageTypeDefs,
        tagTypeDefs
    ],
    resolvers: [
        userResolvers,
        noteResolvers,
        imageResolvers,
        tagResolvers
    ]
});

export default schema;
