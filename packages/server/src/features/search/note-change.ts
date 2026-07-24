import { EventEmitter } from 'node:events';

const NOTE_CHANGE_CHANNEL = 'semantic-search-note-change';
const noteChangeEmitter = new EventEmitter();

export const notifySemanticSearchNoteChanged = (noteId: number) => {
    if (Number.isInteger(noteId) && noteId > 0) {
        noteChangeEmitter.emit(NOTE_CHANGE_CHANNEL, noteId);
    }
};

export const subscribeSemanticSearchNoteChanges = (listener: (noteId: number) => void) => {
    noteChangeEmitter.on(NOTE_CHANGE_CHANNEL, listener);
    return () => noteChangeEmitter.off(NOTE_CHANGE_CHANNEL, listener);
};
