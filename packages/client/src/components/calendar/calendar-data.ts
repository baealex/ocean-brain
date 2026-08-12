import dayjs from 'dayjs';
import type { Note } from '~/models/note.model';
import type { CalendarDisplayType, CalendarGridDay } from './types';

export const getCalendarMonthRange = (year: number, month: number) => ({
    start: new Date(year, month - 1, 1).toISOString(),
    end: new Date(year, month, 1).toISOString(),
});

export const toCalendarTimestamp = (value: string) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : Date.parse(value);
};

export const sortCalendarNotes = <TNote extends Pick<Note, 'createdAt' | 'updatedAt'>>(
    notes: TNote[],
    type: CalendarDisplayType,
) => {
    const dateField = type === 'create' ? 'createdAt' : 'updatedAt';
    return [...notes].sort(
        (left, right) => toCalendarTimestamp(left[dateField]) - toCalendarTimestamp(right[dateField]),
    );
};

export const buildCalendarGridDays = (year: number, month: number, now: Date = new Date()): CalendarGridDay[] => {
    const today = dayjs(now);
    const todayKey = `${today.year()}-${today.month() + 1}-${today.date()}`;
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const firstDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const days: Array<Pick<CalendarGridDay, 'day' | 'isCurrentMonth' | 'year' | 'month'>> = [];
    const previousMonth = month === 1 ? 12 : month - 1;
    const previousYear = month === 1 ? year - 1 : year;
    const previousMonthLastDay = new Date(previousYear, previousMonth, 0).getDate();

    for (let index = firstDayOfWeek - 1; index >= 0; index--) {
        days.push({
            day: previousMonthLastDay - index,
            isCurrentMonth: false,
            year: previousYear,
            month: previousMonth,
        });
    }

    for (let day = 1; day <= totalDays; day++) {
        days.push({ day, isCurrentMonth: true, year, month });
    }

    const lastDayOfWeek = (firstDayOfWeek + totalDays) % 7;
    const daysToFill = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;

    for (let day = 1; day <= daysToFill; day++) {
        days.push({ day, isCurrentMonth: false, year: nextYear, month: nextMonth });
    }

    return days.map((day, index) => {
        const key = `${day.year}-${day.month}-${day.day}`;
        const date = dayjs(new Date(day.year, day.month - 1, day.day));

        return {
            ...day,
            key,
            isSunday: index % 7 === 0,
            isToday: key === todayKey,
            isPast: date.isBefore(today, 'day'),
        };
    });
};
