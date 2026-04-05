import dayjs from 'dayjs';

import * as Icon from '~/components/icon';
import type { Reminder } from '~/models/reminder.model';
import { CalendarEntryCard } from './CalendarEntryCard';

interface Props {
    reminder: Reminder;
}

export const ReminderCard = ({ reminder }: Props) => {
    return (
        <CalendarEntryCard
            params={{ id: String(reminder.note?.id ?? reminder.noteId) }}
            header={<Icon.Bell size={12} />}
            title={reminder.content || reminder.note?.title || 'No title'}
            titleClassName={reminder.completed ? 'line-through' : ''}
            meta={dayjs(Number(reminder.reminderDate)).format('HH:mm')}
        />
    );
};
