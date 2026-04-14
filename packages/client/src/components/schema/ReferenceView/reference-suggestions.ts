import type { Note } from '~/models/note.model';

export const filterReferenceSuggestionNotes = (notes: Pick<Note, 'id' | 'title'>[], currentNoteId?: string) => {
    if (!currentNoteId) {
        return notes;
    }

    return notes.filter((note) => note.id !== currentNoteId);
};
