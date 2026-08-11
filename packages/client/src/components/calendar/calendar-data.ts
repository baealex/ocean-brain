import type { Note } from '~/models/note.model';
import type { CalendarDisplayType } from './types';

export const getCalendarMonthRange = (year: number, month: number) => ({
    start: new Date(year, month - 1, 1).toISOString(),
    end: new Date(year, month, 1).toISOString(),
});

const toTimestamp = (value: string) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : Date.parse(value);
};

export const sortCalendarNotes = (notes: Note[], type: CalendarDisplayType) => {
    const dateField = type === 'create' ? 'createdAt' : 'updatedAt';
    return [...notes].sort((left, right) => toTimestamp(left[dateField]) - toTimestamp(right[dateField]));
};
