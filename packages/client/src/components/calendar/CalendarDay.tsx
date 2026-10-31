import dayjs from 'dayjs';
import { isReminderOverdue } from '~/components/reminder/reminder-time';
import type { Note } from '~/models/note.model';
import type { Reminder } from '~/models/reminder.model';
import { CalendarDayView } from './CalendarDayView';
import { getCalendarCellClassName, getCalendarDayNumberClassName } from './calendar-styles';
import type { CalendarDayPreviewItem } from './types';

const MAX_PREVIEW_ITEMS = 2;

interface Props {
    year: number;
    month: number;
    day: number;
    isCurrentMonth: boolean;
    isSunday: boolean;
    isToday: boolean;
    isSelected: boolean;
    isPast: boolean;
    notes: Note[];
    reminders: Reminder[];
    onSelect: () => void;
}

const CalendarDayComponent = ({
    year,
    month,
    day,
    isCurrentMonth,
    isSunday,
    isToday,
    isSelected,
    isPast,
    notes,
    reminders,
    onSelect,
}: Props) => {
    const noteItems: CalendarDayPreviewItem[] = notes.slice(0, MAX_PREVIEW_ITEMS).map((note) => ({
        key: `note-${note.id}`,
        type: 'note',
        title: note.title,
    }));
    const reminderItems: CalendarDayPreviewItem[] = reminders.slice(0, MAX_PREVIEW_ITEMS).map((reminder) => ({
        key: `reminder-${reminder.id}`,
        type: 'reminder',
        title: reminder.content || reminder.note?.title || 'No title',
        isCompleted: reminder.completed,
        priority: reminder.priority || 'low',
        isOverdue: !reminder.completed && isReminderOverdue(Number(reminder.reminderDate)),
    }));
    const previewItems = (isPast ? [...noteItems, ...reminderItems] : [...reminderItems, ...noteItems]).slice(
        0,
        MAX_PREVIEW_ITEMS,
    );

    const date = dayjs(new Date(year, month - 1, day));

    return (
        <CalendarDayView
            day={day}
            dateLabel={date.format('dddd, MMMM D, YYYY')}
            cellClassName={getCalendarCellClassName({ isCurrentMonth, isSelected })}
            dayNumberClassName={getCalendarDayNumberClassName({ isCurrentMonth, isSunday, isToday })}
            isCurrentMonth={isCurrentMonth}
            isToday={isToday}
            isSelected={isSelected}
            noteCount={notes.length}
            reminderCount={reminders.length}
            previewItems={previewItems}
            overflowCount={Math.max(0, notes.length + reminders.length - MAX_PREVIEW_ITEMS)}
            adjacentMonthLabel={isCurrentMonth ? undefined : `go to ${date.format('MMMM')}`}
            onSelect={onSelect}
        />
    );
};

export const CalendarDay = CalendarDayComponent;
