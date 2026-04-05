import dayjs from 'dayjs';
import { useMemo } from 'react';
import { getRouteApi } from '@tanstack/react-router';

import {
    CalendarDay,
    CalendarHeader,
    PriorityLegend,
    useCalendarData
} from '~/components/calendar';
import type { CalendarDisplayType } from '~/components/calendar';
import { Callout, PageLayout } from '~/components/shared';
import { Skeleton, ToggleGroup, ToggleGroupItem } from '~/components/ui';
import type { Note } from '~/models/note.model';
import type { Reminder } from '~/models/reminder.model';
import { CALENDAR_ROUTE } from '~/modules/url';

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const EMPTY_NOTES: Note[] = [];
const EMPTY_REMINDERS: Reminder[] = [];

interface CalendarDayView {
    key: string;
    day: number;
    isCurrentMonth: boolean;
    isSunday: boolean;
    isToday: boolean;
    isPast: boolean;
    notes: Note[];
    reminders: Reminder[];
}

const Route = getRouteApi(CALENDAR_ROUTE);

export default function Calendar() {
    const navigate = Route.useNavigate();
    const {
        year,
        month,
        type
    } = Route.useSearch();

    const { notes, reminders, isLoading, isError } = useCalendarData({
        year,
        month
    });

    const calendarDayViews = useMemo(() => {
        const today = dayjs();
        const todayKey = `${today.year()}-${today.month() + 1}-${today.date()}`;

        // Build notes map
        const notesMap = new Map<string, Note[]>();
        for (const note of notes) {
            const date = type === 'create'
                ? dayjs(Number(note.createdAt))
                : dayjs(Number(note.updatedAt));
            const key = `${date.year()}-${date.month() + 1}-${date.date()}`;
            const existing = notesMap.get(key) || [];
            existing.push(note);
            notesMap.set(key, existing);
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

        interface DayEntry { day: number; isCurrentMonth: boolean; year: number; month: number }
        const days: DayEntry[] = [];

        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prevMonthLastDay = new Date(prevYear, prevMonth, 0).getDate();

        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            days.push({
                day: prevMonthLastDay - i,
                isCurrentMonth: false,
                year: prevYear,
                month: prevMonth
            });
        }
        for (let d = 1; d <= totalDays; d++) {
            days.push({
                day: d,
                isCurrentMonth: true,
                year,
                month
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
                month: nextMonth
            });
        }

        // Merge into stable view objects
        return days.map((d, index): CalendarDayView => {
            const key = `${d.year}-${d.month}-${d.day}`;
            const dayDate = dayjs(`${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`);
            return {
                key,
                day: d.day,
                isCurrentMonth: d.isCurrentMonth,
                isSunday: index % 7 === 0,
                isToday: key === todayKey,
                isPast: dayDate.isBefore(today, 'day'),
                notes: notesMap.get(key) || EMPTY_NOTES,
                reminders: remindersMap.get(key) || EMPTY_REMINDERS
            };
        });
    }, [year, month, notes, reminders, type]);

    const handlePrevMonth = () => {
        const newMonth = month === 1 ? 12 : month - 1;
        const newYear = month === 1 ? year - 1 : year;
        navigate({
            search: prev => ({
                ...prev,
                month: newMonth,
                year: newYear
            })
        });
    };

    const handleNextMonth = () => {
        const newMonth = month === 12 ? 1 : month + 1;
        const newYear = month === 12 ? year + 1 : year;
        navigate({
            search: prev => ({
                ...prev,
                month: newMonth,
                year: newYear
            })
        });
    };

    const handleToday = () => {
        navigate({
            search: prev => ({
                ...prev,
                month: dayjs().month() + 1,
                year: dayjs().year()
            })
        });
    };

    const handleTypeChange = (value: string) => {
        if (!value) return;
        navigate({
            search: prev => ({
                ...prev,
                type: value as CalendarDisplayType
            })
        });
    };

    return (
        <PageLayout title="Calendar" variant="none">
            <div className="w-full px-4 sm:px-6 py-6 sm:py-10 max-w-screen-2xl mx-auto">
                {isError ? (
                    <Callout>Failed to load calendar data. Please try again later.</Callout>
                ) : (
                    <div className="surface-base overflow-x-auto p-3 sm:p-4">
                        <CalendarHeader
                            month={month}
                            year={year}
                            onPrevMonth={handlePrevMonth}
                            onNextMonth={handleNextMonth}
                            onToday={handleToday}
                        />
                        <div className="min-w-[900px]">
                            {/* Week header */}
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {DAYS_OF_WEEK.map((day, index) => (
                                    <div
                                        key={day}
                                        className={`
                                            py-2 text-center text-xs font-bold tracking-wider
                                            ${index === 0 ? 'text-fg-weekend' : 'text-fg-secondary'}
                                        `}>
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar grid */}
                            {isLoading ? (
                                <div className="grid grid-cols-7 gap-1">
                                    {Array.from({ length: 35 }).map((_, i) => (
                                        <Skeleton key={i} height={140} />
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-7 gap-1">
                                    {calendarDayViews.map((view) => (
                                        <CalendarDay
                                            key={view.key}
                                            day={view.day}
                                            isCurrentMonth={view.isCurrentMonth}
                                            isSunday={view.isSunday}
                                            isToday={view.isToday}
                                            isPast={view.isPast}
                                            notes={view.notes}
                                            reminders={view.reminders}
                                            type={type}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6">
                    <PriorityLegend />
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-fg-tertiary font-bold">
                            Display by:
                        </span>
                        <ToggleGroup
                            type="single"
                            variant="pills"
                            size="sm"
                            value={type}
                            onValueChange={handleTypeChange}>
                            <ToggleGroupItem value="create">
                                Create date
                            </ToggleGroupItem>
                            <ToggleGroupItem value="update">
                                Update date
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                </div>
            </div>
        </PageLayout>
    );
}
