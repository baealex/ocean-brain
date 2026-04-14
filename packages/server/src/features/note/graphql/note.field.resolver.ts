import type { IResolvers } from '@graphql-tools/utils';
import type { Note } from '~/models.js';
import models from '~/models.js';

type NoteFieldResolvers = NonNullable<IResolvers['Note']>;

export const noteFieldResolvers: NoteFieldResolvers = {
    tags: async (note: Note) => models.tag.findMany({ where: { notes: { some: { id: note.id } } } }),
    contentAsMarkdown: async (note: Note) => {
        const { blocksToMarkdown } = await import('~/modules/blocknote.js');
        return blocksToMarkdown(note.content);
    },
};
