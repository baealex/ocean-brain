import classNames from 'classnames';
import dayjs from 'dayjs';

import * as Icon from '~/components/icon';
import { isReminderOverdue } from '~/components/reminder/reminder-time';
import { Text } from '~/components/ui';
import type { Reminder } from '~/models/reminder.model';
import { priorityColors } from '~/modules/color';
import { CalendarEntryCard } from './CalendarEntryCard';

interface Props {
    reminder: Reminder;
}

const PRIORITY_LABELS: Record<string, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

export const ReminderCard = ({ reminder }: Props) => {
    const reminderTime = Number(reminder.reminderDate);
    const priority = reminder.priority || 'low';
    const isOverdue = !reminder.completed && isReminderOverdue(reminderTime);

    return (
        <CalendarEntryCard
            params={{ id: String(reminder.note?.id ?? reminder.noteId) }}
            header={<Icon.Bell size={12} />}
            title={reminder.content || reminder.note?.title || 'No title'}
            titleClassName={reminder.completed ? 'line-through' : ''}
            meta={
                <span className="inline-flex flex-wrap items-center gap-x-1.5">
                    <span>{dayjs(reminderTime).format('HH:mm')}</span>
                    <span className="inline-flex items-center gap-1">
                        <span
                            aria-hidden="true"
                            className={classNames('h-1.5 w-1.5 rounded-full', priorityColors[priority])}
                        />
                        <span>{PRIORITY_LABELS[priority] ?? PRIORITY_LABELS.low}</span>
                        <span className="sr-only"> priority</span>
                    </span>
                    {reminder.completed || isOverdue ? (
                        <Text
                            as="span"
                            variant="micro"
                            weight="semibold"
                            tone={reminder.completed ? 'success' : 'error'}
                            className="!text-[11px] !leading-4"
                        >
                            {reminder.completed ? 'Completed' : 'Overdue'}
                        </Text>
                    ) : null}
                </span>
            }
        />
    );
};
