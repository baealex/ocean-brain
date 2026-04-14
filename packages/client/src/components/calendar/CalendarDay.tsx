import { memo, useCallback, useMemo, useState } from 'react';

import { Modal } from '~/components/ui';
import type { Note } from '~/models/note.model';
import type { Reminder } from '~/models/reminder.model';
import { CalendarDayView } from './CalendarDayView';
import { NoteCard } from './NoteCard';
import { ReminderCard } from './ReminderCard';
import type { CalendarDisplayType, CalendarItem } from './types';

const MAX_VISIBLE_ITEMS = 3;

interface Props {
    year: number;
    month: number;
    day: number;
    isCurrentMonth: boolean;
    isSunday: boolean;
    isToday: boolean;
    isPast: boolean;
    notes: Note[];
    reminders: Reminder[];
    type: CalendarDisplayType;
}

const renderItems = (items: CalendarItem[], type: CalendarDisplayType) =>
    items.map((calendarItem) =>
        calendarItem.type === 'note' ? (
            <NoteCard key={`note-${calendarItem.item.id}`} note={calendarItem.item} type={type} />
        ) : (
            <ReminderCard key={`reminder-${calendarItem.item.id}`} reminder={calendarItem.item} />
        ),
    );

const CalendarDayComponent = ({
    year,
    month,
    day,
    isCurrentMonth,
    isSunday,
    isToday,
    isPast,
    notes,
    reminders,
    type,
}: Props) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const sortedItems = useMemo<CalendarItem[]>(() => {
        const noteItems: CalendarItem[] = notes.map((n) => ({
            type: 'note',
            item: n,
        }));
        const reminderItems: CalendarItem[] = reminders.map((r) => ({
            type: 'reminder',
            item: r,
        }));

        return isPast ? [...noteItems, ...reminderItems] : [...reminderItems, ...noteItems];
    }, [isPast, notes, reminders]);

    const hasOverflow = sortedItems.length > MAX_VISIBLE_ITEMS;
    const visibleItems = useMemo(() => renderItems(sortedItems.slice(0, MAX_VISIBLE_ITEMS), type), [sortedItems, type]);
    const allItems = useMemo(() => renderItems(sortedItems, type), [sortedItems, type]);

    const handleOpenModal = useCallback(() => setIsModalOpen(true), []);
    const handleCloseModal = useCallback(() => setIsModalOpen(false), []);

    const getCellStyle = () => {
        if (!isCurrentMonth) {
            return 'bg-muted/18 border-border-subtle/70';
        }
        if (isToday) {
            return 'border-border-secondary/70 bg-[color:color-mix(in_srgb,var(--surface)_88%,var(--accent-soft-primary)_12%)]';
        }
        return 'bg-surface border-border-subtle';
    };

    const getDayNumberStyle = () => {
        if (isToday) {
            return 'bg-cta text-fg-on-filled font-semibold';
        }
        if (!isCurrentMonth) {
            return 'text-fg-disabled opacity-55';
        }
        if (isSunday) {
            return 'text-fg-weekend font-bold';
        }
        return 'text-fg-secondary font-bold';
    };

    return (
        <>
            <CalendarDayView
                day={day}
                cellClassName={getCellStyle()}
                dayNumberClassName={getDayNumberStyle()}
                isCurrentMonth={isCurrentMonth}
                items={visibleItems}
                overflowCount={hasOverflow ? sortedItems.length - MAX_VISIBLE_ITEMS : 0}
                onOpenOverflow={handleOpenModal}
            />

            {hasOverflow && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} variant="inspect">
                    <Modal.Header
                        title={`${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`}
                        onClose={handleCloseModal}
                    />
                    <Modal.Body>
                        <Modal.Description className="sr-only">
                            View all notes and reminders scheduled for day {day}.
                        </Modal.Description>
                        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">{allItems}</div>
                    </Modal.Body>
                </Modal>
            )}
        </>
    );
};

export const CalendarDay = memo(CalendarDayComponent);
