import type { Note } from './note.model';

export interface Reminder {
    id: string;
    noteId: number;
    reminderDate: string;
    completed: boolean;
    createdAt: string;
    updatedAt: string;
    note?: Note;
}

export interface Reminders {
    totalCount: number;
    reminders: Reminder[];
}
