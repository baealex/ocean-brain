import { getRouteApi } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import type { CalendarDayData, CalendarDisplayType } from '~/components/calendar';
import { CalendarHeader, CalendarMonth, useCalendarData } from '~/components/calendar';
import { sortCalendarNotes } from '~/components/calendar/calendar-data';
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
        const today = dayjs();
        const todayKey = `${today.year()}-${today.month() + 1}-${today.date()}`;

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

        // Build calendar grid
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        const firstDayOfWeek = firstDay.getDay();
        const totalDays = lastDay.getDate();

        interface DayEntry {
            day: number;
            isCurrentMonth: boolean;
            year: number;
            month: number;
        }
        const days: DayEntry[] = [];

        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prevMonthLastDay = new Date(prevYear, prevMonth, 0).getDate();

        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            days.push({
                day: prevMonthLastDay - i,
                isCurrentMonth: false,
                year: prevYear,
                month: prevMonth,
            });
        }
        for (let d = 1; d <= totalDays; d++) {
            days.push({
                day: d,
                isCurrentMonth: true,
                year,
                month,
            });
        }
        const lastDayOfWeek = (firstDayOfWeek + totalDays) % 7;
        const daysToFill = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        for (let i = 1; i <= daysToFill; i++) {
            days.push({
                day: i,
                isCurrentMonth: false,
                year: nextYear,
                month: nextMonth,
            });
        }

        // Merge into stable view objects
        return days.map((d, index): CalendarDayData => {
            const key = `${d.year}-${d.month}-${d.day}`;
            const dayDate = dayjs(`${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`);
            return {
                key,
                year: d.year,
                month: d.month,
                day: d.day,
                isCurrentMonth: d.isCurrentMonth,
                isSunday: index % 7 === 0,
                isToday: key === todayKey,
                isPast: dayDate.isBefore(today, 'day'),
                notes: notesMap.get(key) || EMPTY_NOTES,
                reminders: remindersMap.get(key) || EMPTY_REMINDERS,
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
