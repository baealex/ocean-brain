import { EventEmitter } from 'node:events';

export type NoteChangeEventType = 'note.created' | 'note.updated' | 'note.deleted';

export interface NoteChangeEvent {
    type: NoteChangeEventType;
    noteId: number;
    occurredAt: string;
    affectsSearchIndex: boolean;
}

export interface NoteChangeEventInput {
    type: NoteChangeEventType;
    noteId: number;
    affectsSearchIndex?: boolean;
}

type NoteChangeListener = (event: NoteChangeEvent) => void;

const NOTE_CHANGE_CHANNEL = 'note-change';
const noteChangeEmitter = new EventEmitter();

noteChangeEmitter.setMaxListeners(0);

export const emitNoteChange = (input: NoteChangeEventInput) => {
    if (!Number.isInteger(input.noteId) || input.noteId <= 0) {
        return null;
    }

    const event: NoteChangeEvent = {
        ...input,
        occurredAt: new Date().toISOString(),
        affectsSearchIndex: input.affectsSearchIndex ?? true,
    };

    noteChangeEmitter.emit(NOTE_CHANGE_CHANNEL, event);
    return event;
};

export const subscribeNoteChanges = (listener: NoteChangeListener) => {
    noteChangeEmitter.on(NOTE_CHANGE_CHANNEL, listener);
    return () => {
        noteChangeEmitter.off(NOTE_CHANGE_CHANNEL, listener);
    };
};
