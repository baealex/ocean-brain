import type { Note } from '~/models/note.model';
import type { Reminder } from '~/models/reminder.model';

export type CalendarDisplayType = 'create' | 'update';

export type CalendarItem =
    | { type: 'note'; item: Note }
    | { type: 'reminder'; item: Reminder };
