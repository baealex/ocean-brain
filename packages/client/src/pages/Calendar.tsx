import dayjs from 'dayjs';
import { useCallback, useMemo, useRef } from 'react';
import { getRouteApi } from '@tanstack/react-router';

import {
    CalendarDay,
    CalendarHeader,
    useCalendarData
} from '~/components/calendar';
import type { CalendarDisplayType } from '~/components/calendar';
import { Callout, PageLayout } from '~/components/shared';
import { Skeleton } from '~/components/ui';
import type { Note } from '~/models/note.model';
import type { Reminder } from '~/models/reminder.model';
import { CALENDAR_ROUTE } from '~/modules/url';

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const EMPTY_NOTES: Note[] = [];
const EMPTY_REMINDERS: Reminder[] = [];

interface CalendarDayView {
    key: string;
    year: number;
    month: number;
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

    const gridScrollRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const dragStartX = useRef(0);
    const dragScrollLeft = useRef(0);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        isDragging.current = true;
        dragStartX.current = e.pageX - (gridScrollRef.current?.offsetLeft ?? 0);
        dragScrollLeft.current = gridScrollRef.current?.scrollLeft ?? 0;
        if (gridScrollRef.current) {
            gridScrollRef.current.style.cursor = 'grabbing';
            gridScrollRef.current.style.userSelect = 'none';
        }
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging.current || !gridScrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - gridScrollRef.current.offsetLeft;
        const walk = (x - dragStartX.current) * 1.2;
        gridScrollRef.current.scrollLeft = dragScrollLeft.current - walk;
    }, []);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
        if (gridScrollRef.current) {
            gridScrollRef.current.style.cursor = 'grab';
            gridScrollRef.current.style.userSelect = '';
        }
    }, []);

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
                year: d.year,
                month: d.month,
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
            {isError ? (
                <Callout>Failed to load calendar data. Please try again later.</Callout>
            ) : (
                <div className="surface-base">
                    {/* Header - not scrollable */}
                    <div className="border-b border-border-subtle px-3 py-3">
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

                    {/* Scrollable grid */}
                    <div
                        ref={gridScrollRef}
                        className="overflow-x-auto cursor-grab px-3 pb-3 pt-2"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}>
                        <div className="min-w-[1260px]">
                            <div className="grid grid-cols-7 gap-1.5 mb-2">
                                {DAYS_OF_WEEK.map((day, index) => (
                                    <div
                                        key={day}
                                        className={`py-2 text-center text-label font-semibold uppercase tracking-[0.12em] ${index === 0 ? 'text-fg-weekend' : 'text-fg-tertiary'}`}>
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {isLoading ? (
                                <div className="grid grid-cols-7 gap-1.5">
                                    {Array.from({ length: 35 }).map((_, i) => (
                                        <Skeleton key={i} height={180} />
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-7 gap-1.5">
                                    {calendarDayViews.map((view) => (
                                        <CalendarDay
                                            key={view.key}
                                            year={view.year}
                                            month={view.month}
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
                </div>
            )}
        </PageLayout>
    );
}
