import dayjs from 'dayjs';

import type { Note } from '~/models/note.model';
import type { Reminder } from '~/models/reminder.model';
import { CalendarDayView } from './CalendarDayView';
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
    }));
    const previewItems = (isPast ? [...noteItems, ...reminderItems] : [...reminderItems, ...noteItems]).slice(
        0,
        MAX_PREVIEW_ITEMS,
    );

    const getCellStyle = () => {
        if (!isCurrentMonth) {
            return 'cursor-default bg-[var(--page-bg)] text-fg-disabled';
        }
        if (isSelected) {
            return 'bg-elevated shadow-[inset_0_0_0_1px_var(--border-secondary)] hover:bg-surface';
        }
        return 'bg-surface hover:bg-muted';
    };

    const getDayNumberStyle = () => {
        if (isToday) {
            return 'bg-cta font-semibold text-fg-on-filled';
        }
        if (!isCurrentMonth) {
            return 'font-medium text-fg-tertiary';
        }
        if (isSunday) {
            return 'font-semibold text-fg-weekend';
        }
        return 'font-semibold text-fg-secondary';
    };

    return (
        <CalendarDayView
            day={day}
            dateLabel={dayjs(new Date(year, month - 1, day)).format('dddd, MMMM D, YYYY')}
            cellClassName={getCellStyle()}
            dayNumberClassName={getDayNumberStyle()}
            isCurrentMonth={isCurrentMonth}
            isToday={isToday}
            isSelected={isSelected}
            noteCount={notes.length}
            reminderCount={reminders.length}
            previewItems={previewItems}
            overflowCount={Math.max(0, notes.length + reminders.length - MAX_PREVIEW_ITEMS)}
            onSelect={onSelect}
        />
    );
};

export const CalendarDay = CalendarDayComponent;
