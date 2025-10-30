import dayjs from 'dayjs';
import { Helmet } from 'react-helmet';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import * as Icon from '~/components/icon';
import type { Note } from '~/models/note.model';
import type { Reminder } from '~/models/reminder.model';
import { getRandomBackground } from '~/modules/color';
import { graphQuery } from '~/modules/graph-query';
import { getNoteURL } from '~/modules/url';

interface CalendarHeaderProps {
    month: number;
    year: number;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onToday: () => void;
}

interface CalendarDayProps {
    day: number | null;
    isSunday: boolean;
    isToday: boolean;
    notes: Note[];
    reminders: Reminder[];
    type: string;
}

interface NoteCardProps {
    note: Note;
    type: string;
}

interface ReminderCardProps {
    reminder: Reminder;
}

const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
];

const DAYS_OF_WEEK = [
    'SUN',
    'MON',
    'TUE',
    'WED',
    'THU',
    'FRI',
    'SAT'
];

function CalendarHeader({
    month,
    year,
    onPrevMonth,
    onNextMonth,
    onToday
}: CalendarHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold">
                {MONTHS[month - 1]} {year}
            </h1>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <button
                    onClick={onToday}
                    className="px-3 sm:px-4 py-2 text-sm font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors">
                    Today
                </button>
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    <button
                        onClick={onPrevMonth}
                        className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <Icon.ChevronLeft width={20} height={20} />
                    </button>
                    <button
                        onClick={onNextMonth}
                        className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <Icon.ChevronRight width={20} height={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}

function NoteCard({ note, type }: NoteCardProps) {
    return (
        <Link to={getNoteURL(note.id)}>
            <div className={`${getRandomBackground(note.title)} text-xs rounded p-2 hover:opacity-90 transition-opacity cursor-pointer`}>
                <div className="font-medium text-xs">{note.title}</div>
                <div className="text-zinc-600 dark:text-zinc-400 text-[11px] sm:text-[10px] mt-1">
                    {dayjs(type === 'create' ? Number(note.createdAt) : Number(note.updatedAt)).format('HH:mm')}
                </div>
            </div>
        </Link>
    );
}

function ReminderCard({ reminder }: ReminderCardProps) {
    const priorityColors = {
        high: 'bg-gradient-to-br from-rose-100 to-rose-200 dark:from-rose-950/50 dark:to-rose-900/50',
        medium: 'bg-gradient-to-br from-violet-100 to-violet-200 dark:from-violet-950/50 dark:to-violet-900/50',
        low: 'bg-gradient-to-br from-sky-100 to-sky-200 dark:from-sky-950/50 dark:to-sky-900/50'
    };

    const badgeColors = {
        high: 'bg-rose-200 dark:bg-rose-900/70 text-rose-700 dark:text-rose-300',
        medium: 'bg-violet-200 dark:bg-violet-900/70 text-violet-700 dark:text-violet-300',
        low: 'bg-sky-200 dark:bg-sky-900/70 text-sky-700 dark:text-sky-300'
    };

    return (
        <Link to={getNoteURL(reminder.note?.id || '')}>
            <div className={`text-xs rounded p-2 hover:opacity-90 transition-opacity cursor-pointer ${priorityColors[reminder.priority || 'medium']} ${reminder.completed ? 'opacity-50 line-through' : ''}`}>
                <div className="flex items-center justify-between gap-1 mb-1">
                    <Icon.Bell width={14} height={14} className="sm:w-3 sm:h-3 flex-shrink-0 opacity-70" />
                    {reminder.priority && (
                        <span className={`text-[10px] sm:text-[9px] px-1.5 py-0.5 rounded-full font-medium ${badgeColors[reminder.priority]}`}>
                            {reminder.priority.charAt(0).toUpperCase()}
                        </span>
                    )}
                </div>
                <div className="font-medium line-clamp-1 text-xs">
                    {reminder.content || reminder.note?.title || 'No title'}
                </div>
                <div className="text-zinc-600 dark:text-zinc-400 text-[11px] sm:text-[10px] mt-1">
                    {dayjs(Number(reminder.reminderDate)).format('HH:mm')}
                </div>
            </div>
        </Link>
    );
}

function CalendarDay({
    day, isSunday, isToday, notes, reminders, type
}: CalendarDayProps) {
    if (!day) {
        return <div className="min-h-[140px] sm:min-h-[120px] bg-zinc-50/50 dark:bg-zinc-800/50 border-r border-b border-zinc-200 dark:border-zinc-700" />;
    }

    return (
        <div className="min-h-[140px] sm:min-h-[120px] bg-white dark:bg-zinc-900 border-r border-b border-zinc-200 dark:border-zinc-700">
            <div className="p-2 flex justify-end">
                <span
                    className={`flex items-center justify-center w-8 h-8 sm:w-7 sm:h-7 text-base sm:text-sm font-medium rounded-full ${
                    isToday
                        ? 'bg-blue-500 text-white'
                        : isSunday
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-zinc-700 dark:text-zinc-300'
                }`}>
                    {day}
                </span>
            </div>

            <div className="px-2 pb-2 space-y-2 overflow-y-auto flex flex-col gap-1">
                {notes.map(note => (
                    <NoteCard key={`note-${note.id}`} note={note} type={type} />
                ))}
                {reminders.map(reminder => (
                    <ReminderCard key={`reminder-${reminder.id}`} reminder={reminder} />
                ))}
            </div>
        </div>
    );
}

function PriorityLegend() {
    return (
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-gradient-to-br from-rose-100 to-rose-200 dark:from-rose-950/50 dark:to-rose-900/50" />
                <span className="text-gray-600 dark:text-gray-400">High</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-gradient-to-br from-violet-100 to-violet-200 dark:from-violet-950/50 dark:to-violet-900/50" />
                <span className="text-gray-600 dark:text-gray-400">Medium</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-gradient-to-br from-sky-100 to-sky-200 dark:from-sky-950/50 dark:to-sky-900/50" />
                <span className="text-gray-600 dark:text-gray-400">Low</span>
            </div>
        </div>
    );
}

export default function Calendar() {
    const [searchParams, setSearchParams] = useSearchParams();
    const year = Number(searchParams.get('year')) || dayjs().year();
    const month = Number(searchParams.get('month')) || dayjs().month() + 1;
    const type = searchParams.get('type') || 'create';

    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const firstDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const calendarDays: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
        calendarDays.push(null);
    }
    for (let day = 1; day <= totalDays; day++) {
        calendarDays.push(day);
    }
    const lastDayOfWeek = (firstDayOfWeek + totalDays) % 7;
    const daysToFill = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
    for (let i = 0; i < daysToFill; i++) {
        calendarDays.push(null);
    }

    const handlePrevMonth = () => {
        const newMonth = month === 1 ? 12 : month - 1;
        const newYear = month === 1 ? year - 1 : year;
        setSearchParams(params => {
            params.set('month', newMonth.toString());
            params.set('year', newYear.toString());
            return params;
        });
    };

    const handleNextMonth = () => {
        const newMonth = month === 12 ? 1 : month + 1;
        const newYear = month === 12 ? year + 1 : year;
        setSearchParams(params => {
            params.set('month', newMonth.toString());
            params.set('year', newYear.toString());
            return params;
        });
    };

    const handleToday = () => {
        setSearchParams(params => {
            params.set('month', (dayjs().month() + 1).toString());
            params.set('year', dayjs().year().toString());
            return params;
        });
    };

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const { data: notes = [] } = useQuery({
        queryKey: ['notesInDateRange', year, month],
        async queryFn() {
            const response = await graphQuery<{ notesInDateRange: Note[] }>(
                `query def($dateRange: DateRangeInput) {
                    notesInDateRange(dateRange: $dateRange) {
                        id
                        title
                        createdAt
                        updatedAt
                    }
                }`,
                {
                    dateRange: {
                        start: startDate,
                        end: endDate
                    }
                }
            );
            if (response.type === 'error') throw response;
            return response.notesInDateRange;
        }
    });

    const { data: reminders = [] } = useQuery({
        queryKey: ['remindersInDateRange', year, month],
        async queryFn() {
            const response = await graphQuery<{ remindersInDateRange: Reminder[] }>(
                `query def($dateRange: DateRangeInput) {
                    remindersInDateRange(dateRange: $dateRange) {
                        id
                        noteId
                        reminderDate
                        completed
                        priority
                        content
                        note {
                            id
                            title
                        }
                    }
                }`,
                {
                    dateRange: {
                        start: startDate,
                        end: endDate
                    }
                }
            );
            if (response.type === 'error') throw response;
            return response.remindersInDateRange;
        }
    });

    const isToday = (day: number | null) => {
        if (!day) return false;
        const today = dayjs();
        return today.date() === day && today.month() + 1 === month && today.year() === year;
    };

    const getItemsForDay = (day: number | null) => {
        if (!day) return {
            notes: [],
            reminders: []
        };

        const dayNotes = notes.filter(note => {
            const date = type === 'create' ? dayjs(Number(note.createdAt)) : dayjs(Number(note.updatedAt));
            return date.date() === day && date.year() === year && date.month() + 1 === month;
        });

        const dayReminders = reminders.filter(reminder => {
            const date = dayjs(Number(reminder.reminderDate));
            return date.date() === day && date.year() === year && date.month() + 1 === month;
        });

        return {
            notes: dayNotes,
            reminders: dayReminders
        };
    };

    return (
        <>
            <Helmet>
                <title>Calendar | Ocean Brain</title>
            </Helmet>
            <div className="w-full px-2 sm:px-4 py-4 sm:py-8 max-w-screen-2xl mx-auto">
                <CalendarHeader
                    month={month}
                    year={year}
                    onPrevMonth={handlePrevMonth}
                    onNextMonth={handleNextMonth}
                    onToday={handleToday}
                />

                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg overflow-x-auto border border-zinc-200 dark:border-zinc-700">
                    <div className="min-w-[1200px]">
                        <div className="grid grid-cols-7 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                            {DAYS_OF_WEEK.map((day, index) => (
                                <div
                                    key={day}
                                    className={`py-3 text-center text-sm font-semibold ${
                                        index === 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-700 dark:text-zinc-300'
                                    }`}>
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7">
                            {calendarDays.map((day, index) => {
                                const { notes: dayNotes, reminders: dayReminders } = getItemsForDay(day);
                                return (
                                    <CalendarDay
                                        key={index}
                                        day={day}
                                        isSunday={index % 7 === 0}
                                        isToday={isToday(day)}
                                        notes={dayNotes}
                                        reminders={dayReminders}
                                        type={type}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 sm:mt-6">
                    <PriorityLegend />
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Display by:</span>
                        <button
                            className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors capitalize"
                            onClick={() => {
                                setSearchParams(params => {
                                    if (params.get('type') !== 'update') {
                                        params.set('type', 'update');
                                    } else {
                                        params.delete('type');
                                    }
                                    return params;
                                });
                            }}>
                            {type} date
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
