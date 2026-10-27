import type { IResolvers } from '@graphql-tools/utils';
import { getNoteLinkedViews } from '~/features/view/services/note-links.js';
import { noteFieldResolvers, noteSnapshotFieldResolvers } from './note.field.resolver.js';
import { noteMutationResolvers } from './note.mutation.resolver.js';
import { createAllNotesQueryResolver, noteQueryResolvers } from './note.query.resolver.js';

export { createAllNotesQueryResolver } from './note.query.resolver.js';

export const noteResolvers: IResolvers = {
    Query: noteQueryResolvers,
    Mutation: noteMutationResolvers,
    Note: noteFieldResolvers,
    NoteSnapshot: noteSnapshotFieldResolvers,
    NoteReadResult: {
        linkedViews: (result: { note: { content: string } }) => getNoteLinkedViews(result.note.content),
    },
};
