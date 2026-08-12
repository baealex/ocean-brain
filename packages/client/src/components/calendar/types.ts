import type { Note } from '~/models/note.model';
import type { Reminder } from '~/models/reminder.model';

export type CalendarDisplayType = 'create' | 'update';

export type CalendarItem = { type: 'note'; item: Note } | { type: 'reminder'; item: Reminder };

export interface CalendarDayPreviewItem {
    key: string;
    type: CalendarItem['type'];
    title: string;
    isCompleted?: boolean;
}

export interface CalendarGridDay {
    key: string;
    year: number;
    month: number;
    day: number;
    isCurrentMonth: boolean;
    isSunday: boolean;
    isToday: boolean;
    isPast: boolean;
}

export interface CalendarDayData extends CalendarGridDay {
    notes: Note[];
    reminders: Reminder[];
}
