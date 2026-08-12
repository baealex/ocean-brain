import { describe, expect, it } from 'vitest';

import type { Note } from '~/models/note.model';
import { buildCalendarGridDays, getCalendarMonthRange, sortCalendarNotes } from './calendar-data';

const createNote = (id: string, createdAt: string, updatedAt: string) => ({ id, createdAt, updatedAt }) as Note;

describe('calendar data', () => {
    it('builds month boundaries from local midnight as absolute timestamps', () => {
        expect(getCalendarMonthRange(2026, 8)).toEqual({
            start: new Date(2026, 7, 1).toISOString(),
            end: new Date(2026, 8, 1).toISOString(),
        });
    });

    it('sorts notes by the date field shown in the calendar', () => {
        const notes = [createNote('older-update', '1000', '3000'), createNote('newer-update', '2000', '1000')];

        expect(sortCalendarNotes(notes, 'create').map((note) => note.id)).toEqual(['older-update', 'newer-update']);
        expect(sortCalendarNotes(notes, 'update').map((note) => note.id)).toEqual(['newer-update', 'older-update']);
        expect(notes.map((note) => note.id)).toEqual(['older-update', 'newer-update']);
    });

    it('builds a Sunday-first month grid with adjacent days and today state', () => {
        const days = buildCalendarGridDays(2026, 8, new Date(2026, 7, 12, 12));

        expect(days).toHaveLength(42);
        expect(days[0]).toMatchObject({ key: '2026-7-26', isCurrentMonth: false, isSunday: true });
        expect(days.find((day) => day.key === '2026-8-12')).toMatchObject({ isCurrentMonth: true, isToday: true });
        expect(days.at(-1)).toMatchObject({ key: '2026-9-5', isCurrentMonth: false });
    });
});
