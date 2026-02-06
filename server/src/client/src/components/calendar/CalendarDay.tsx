import { memo, useCallback, useMemo, useState } from 'react';

import { Modal } from '~/components/ui';
import type { Note } from '~/models/note.model';
import type { Reminder } from '~/models/reminder.model';
import { NoteCard } from './NoteCard';
import { ReminderCard } from './ReminderCard';
import type { CalendarDisplayType, CalendarItem } from './types';

const MAX_VISIBLE_ITEMS = 3;

interface Props {
    day: number;
    isCurrentMonth: boolean;
    isSunday: boolean;
    isToday: boolean;
    isPast: boolean;
    notes: Note[];
    reminders: Reminder[];
    type: CalendarDisplayType;
}

const renderItems = (items: CalendarItem[], type: CalendarDisplayType, isPast: boolean) =>
    items.map((calendarItem) =>
        calendarItem.type === 'note' ? (
            <NoteCard
                key={`note-${calendarItem.item.id}`}
                note={calendarItem.item}
                type={type}
            />
        ) : (
            <ReminderCard
                key={`reminder-${calendarItem.item.id}`}
                reminder={calendarItem.item}
                isPast={isPast}
            />
        )
    );

const CalendarDayComponent = ({
    day,
    isCurrentMonth,
    isSunday,
    isToday,
    isPast,
    notes,
    reminders,
    type
}: Props) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const sortedItems = useMemo<CalendarItem[]>(() => {
        const noteItems: CalendarItem[] = notes.map(n => ({
            type: 'note',
            item: n
        }));
        const reminderItems: CalendarItem[] = reminders.map(r => ({
            type: 'reminder',
            item: r
        }));

        return isPast
            ? [...noteItems, ...reminderItems]
            : [...reminderItems, ...noteItems];
    }, [isPast, notes, reminders]);

    const hasOverflow = sortedItems.length > MAX_VISIBLE_ITEMS;

    const handleOpenModal = useCallback(() => setIsModalOpen(true), []);
    const handleCloseModal = useCallback(() => setIsModalOpen(false), []);

    const getCellStyle = () => {
        if (!isCurrentMonth) {
            return 'bg-zinc-100/30 dark:bg-zinc-900/20 border-zinc-300 dark:border-zinc-700';
        }
        if (isToday) {
            return 'bg-pastel-blue-200/30 dark:bg-blue-950/20 border-zinc-800 dark:border-zinc-600';
        }
        return 'bg-surface dark:bg-surface-dark border-zinc-300 dark:border-zinc-700';
    };

    const getDayNumberStyle = () => {
        if (isToday) {
            return 'bg-pastel-pink-200 text-zinc-800 border-2 border-zinc-800 font-bold';
        }
        if (!isCurrentMonth) {
            return 'text-zinc-300 dark:text-zinc-600';
        }
        if (isSunday) {
            return 'text-rose-500 dark:text-rose-400 font-bold';
        }
        return 'text-zinc-600 dark:text-zinc-400 font-bold';
    };

    return (
        <>
            <div className={`min-h-[140px] rounded-[8px_3px_9px_2px/3px_6px_3px_7px] border p-2 ${getCellStyle()}`}>
                <div className="flex justify-end mb-2">
                    <span
                        className={`
                            flex items-center justify-center
                            w-7 h-7 text-sm
                            rounded-full
                            ${getDayNumberStyle()}
                        `}>
                        {day}
                    </span>
                </div>

                {isCurrentMonth && sortedItems.length > 0 && (
                    <div className="flex flex-col gap-1">
                        {renderItems(sortedItems.slice(0, MAX_VISIBLE_ITEMS), type, isPast)}
                        {hasOverflow && (
                            <button
                                type="button"
                                onClick={handleOpenModal}
                                className="text-center text-[10px] font-bold text-zinc-500 dark:text-zinc-400 py-1 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-pastel-lavender-200/30 dark:hover:bg-zinc-700/50 rounded-[4px_2px_5px_2px/2px_4px_2px_4px] transition-colors">
                                +{sortedItems.length - MAX_VISIBLE_ITEMS} more
                            </button>
                        )}
                    </div>
                )}
            </div>

            {hasOverflow && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
                    <Modal.Header title={`${day}일`} onClose={handleCloseModal} />
                    <Modal.Body>
                        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
                            {renderItems(sortedItems, type, isPast)}
                        </div>
                    </Modal.Body>
                </Modal>
            )}
        </>
    );
};

export const CalendarDay = memo(CalendarDayComponent);
