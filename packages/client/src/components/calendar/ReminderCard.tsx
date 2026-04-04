import dayjs from 'dayjs';

import * as Icon from '~/components/icon';
import type { Reminder } from '~/models/reminder.model';
import { priorityColorsSubtle } from '~/modules/color';
import { CalendarEntryCard } from './CalendarEntryCard';

interface Props {
    reminder: Reminder;
    isPast: boolean;
}

export const ReminderCard = ({ reminder, isPast }: Props) => {
    const isOverdue = isPast && !reminder.completed;
    const priority = reminder.priority || 'medium';
    const toneClassName = isOverdue
        ? 'bg-accent-soft-danger/70 dark:bg-emphasis/70'
        : priorityColorsSubtle[priority];

    return (
        <CalendarEntryCard
            params={{ id: String(reminder.note?.id ?? reminder.noteId) }}
            toneClassName={toneClassName}
            header={(
                <>
                    <Icon.Bell size={12} />
                    {isOverdue ? (
                        <span className="text-[9px] font-bold text-fg-error">!</span>
                    ) : null}
                </>
            )}
            title={reminder.content || reminder.note?.title || 'No title'}
            titleClassName={reminder.completed ? 'line-through' : ''}
            meta={dayjs(Number(reminder.reminderDate)).format('HH:mm')}
        />
    );
};
