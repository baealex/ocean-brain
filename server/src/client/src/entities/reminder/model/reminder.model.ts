import type { Note } from './note.model';

export type ReminderPriority = 'low' | 'medium' | 'high';

export interface Reminder {
    id: string;
    noteId: number;
    reminderDate: string;
    completed: boolean;
    priority?: ReminderPriority;
    content?: string;
    createdAt: string;
    updatedAt: string;
    note?: Note;
}

export interface Reminders {
    totalCount: number;
    reminders: Reminder[];
}
