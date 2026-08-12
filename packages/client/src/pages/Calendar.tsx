import { getRouteApi } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import type { CalendarDayData, CalendarDisplayType } from '~/components/calendar';
import { CalendarHeader, CalendarMonth, useCalendarData } from '~/components/calendar';
import { buildCalendarGridDays, sortCalendarNotes } from '~/components/calendar/calendar-data';
import { Callout, PageLayout } from '~/components/shared';
import type { Note } from '~/models/note.model';
import type { Reminder } from '~/models/reminder.model';
import { CALENDAR_ROUTE } from '~/modules/url';

const EMPTY_NOTES: Note[] = [];
const EMPTY_REMINDERS: Reminder[] = [];

const Route = getRouteApi(CALENDAR_ROUTE);

export default function Calendar() {
    const navigate = Route.useNavigate();
    const { year, month, type } = Route.useSearch();
    const currentMonthKey = `${year}-${month}`;
    const [calendarSelection, setCalendarSelection] = useState<{ monthKey: string; dayKey?: string }>(() => ({
        monthKey: currentMonthKey,
    }));

    const { notes, reminders, isLoading, isError } = useCalendarData({
        year,
        month,
    });

    const calendarDayViews = useMemo(() => {
        // Build notes map
        const notesMap = new Map<string, Note[]>();
        for (const note of notes) {
            const date = type === 'create' ? dayjs(Number(note.createdAt)) : dayjs(Number(note.updatedAt));
            const key = `${date.year()}-${date.month() + 1}-${date.date()}`;
            const existing = notesMap.get(key) || [];
            existing.push(note);
            notesMap.set(key, existing);
        }
        for (const [key, dayNotes] of notesMap) {
            notesMap.set(key, sortCalendarNotes(dayNotes, type));
        }

        // Build reminders map
        const remindersMap = new Map<string, Reminder[]>();
        for (const reminder of reminders) {
            const date = dayjs(Number(reminder.reminderDate));
            const key = `${date.year()}-${date.month() + 1}-${date.date()}`;
            const existing = remindersMap.get(key) || [];
            existing.push(reminder);
            remindersMap.set(key, existing);
        }

        // Merge into stable view objects
        return buildCalendarGridDays(year, month).map((day): CalendarDayData => {
            return {
                ...day,
                notes: notesMap.get(day.key) || EMPTY_NOTES,
                reminders: remindersMap.get(day.key) || EMPTY_REMINDERS,
            };
        });
    }, [year, month, notes, reminders, type]);

    const defaultSelectedDayKey = calendarDayViews.find((day) => day.isCurrentMonth && day.isToday)?.key;
    const selectedDayKey =
        calendarSelection.monthKey === currentMonthKey
            ? (calendarSelection.dayKey ?? defaultSelectedDayKey)
            : defaultSelectedDayKey;

    const handlePrevMonth = () => {
        const newMonth = month === 1 ? 12 : month - 1;
        const newYear = month === 1 ? year - 1 : year;
        navigate({
            search: (prev) => ({
                ...prev,
                month: newMonth,
                year: newYear,
            }),
        });
    };

    const handleNextMonth = () => {
        const newMonth = month === 12 ? 1 : month + 1;
        const newYear = month === 12 ? year + 1 : year;
        navigate({
            search: (prev) => ({
                ...prev,
                month: newMonth,
                year: newYear,
            }),
        });
    };

    const handleToday = () => {
        const today = dayjs();
        const todayMonth = today.month() + 1;
        const todayYear = today.year();
        setCalendarSelection({
            monthKey: `${todayYear}-${todayMonth}`,
            dayKey: `${todayYear}-${todayMonth}-${today.date()}`,
        });
        navigate({
            search: (prev) => ({
                ...prev,
                month: todayMonth,
                year: todayYear,
            }),
        });
    };

    const handleTypeChange = (value: string) => {
        if (!value) return;
        navigate({
            search: (prev) => ({
                ...prev,
                type: value as CalendarDisplayType,
            }),
        });
    };

    const handleSelectedDayChange = (dayKey: string) => {
        setCalendarSelection({ monthKey: currentMonthKey, dayKey });
    };

    return (
        <PageLayout title="Calendar" variant="none">
            {isError ? (
                <Callout>Failed to load calendar data. Please try again later.</Callout>
            ) : (
                <div className="-mr-4">
                    <div className="border-b border-border-subtle/80 pb-4">
                        <CalendarHeader
                            month={month}
                            year={year}
                            type={type}
                            onPrevMonth={handlePrevMonth}
                            onNextMonth={handleNextMonth}
                            onToday={handleToday}
                            onTypeChange={handleTypeChange}
                        />
                    </div>

                    <div className="pt-4">
                        <CalendarMonth
                            days={calendarDayViews}
                            type={type}
                            isLoading={isLoading}
                            selectedDayKey={selectedDayKey}
                            onSelectedDayChange={handleSelectedDayChange}
                        />
                    </div>
                </div>
            )}
        </PageLayout>
    );
}
