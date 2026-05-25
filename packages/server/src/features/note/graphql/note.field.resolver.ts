import type { IResolvers } from '@graphql-tools/utils';
import { renderNoteSnapshotContentAsMarkdown } from '~/features/note/services/snapshot.js';
import type { Note } from '~/models.js';
import models from '~/models.js';

type NoteFieldResolvers = NonNullable<IResolvers['Note']>;
type NoteSnapshotFieldResolvers = NonNullable<IResolvers['NoteSnapshot']>;

interface NoteSnapshotSource {
    contentAsMarkdown?: string;
    payload?: string;
}

export const noteFieldResolvers: NoteFieldResolvers = {
    tags: async (note: Note) => models.tag.findMany({ where: { notes: { some: { id: note.id } } } }),
    contentAsMarkdown: async (note: Note) => {
        const { blocksToMarkdown } = await import('~/modules/blocknote.js');
        return blocksToMarkdown(note.content);
    },
};

export const noteSnapshotFieldResolvers: NoteSnapshotFieldResolvers = {
    contentAsMarkdown: async (snapshot: NoteSnapshotSource) => {
        if (typeof snapshot.contentAsMarkdown === 'string') {
            return snapshot.contentAsMarkdown;
        }

        if (typeof snapshot.payload === 'string') {
            return renderNoteSnapshotContentAsMarkdown(snapshot.payload);
        }

        return '';
    },
};
