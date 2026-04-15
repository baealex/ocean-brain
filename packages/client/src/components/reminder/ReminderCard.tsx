import { Link } from '@tanstack/react-router';
import dayjs from 'dayjs';

import { Dropdown } from '~/components/shared';
import { Checkbox, MoreButton, Text } from '~/components/ui';
import type { Reminder } from '~/models/reminder.model';
import { priorityColors } from '~/modules/color';
import { NOTE_ROUTE } from '~/modules/url';

interface ReminderCardProps {
    reminder: Reminder;
    onUpdate: (id: string, noteId: string, data: { completed?: boolean }) => void;
    onDelete: (id: string, noteId: string) => void;
}

export default function ReminderCard({ reminder, onUpdate, onDelete }: ReminderCardProps) {
    const formatReminderDate = (dateString: string) => {
        const date = dayjs(Number(dateString));
        const now = dayjs();

        if (date.isSame(now, 'day')) {
            return `Today at ${date.format('HH:mm')}`;
        } else if (date.isSame(now.add(1, 'day'), 'day')) {
            return `Tomorrow at ${date.format('HH:mm')}`;
        } else {
            return date.format('YYYY-MM-DD HH:mm');
        }
    };

    const getTimeRemaining = (dateString: string) => {
        const date = dayjs(Number(dateString));
        const now = dayjs();
        const diffHours = date.diff(now, 'hour');
        const diffMinutes = date.diff(now, 'minute') % 60;

        if (diffHours < 0 || diffMinutes < 0) return 'Overdue';
        if (diffHours === 0) return `${diffMinutes}m remaining`;
        return `${diffHours}h ${diffMinutes}m remaining`;
    };

    const isOverdue = getTimeRemaining(reminder.reminderDate) === 'Overdue';
    const priority = reminder.priority || 'low';
    const priorityLabel = priority === 'high' ? 'High' : priority === 'medium' ? 'Medium' : 'Low';
    const priorityToneClassName = priorityColors[priority];
    const noteId = reminder.noteId.toString();
    const detailToneClassName = isOverdue ? 'text-fg-error' : 'text-fg-tertiary';
    const primaryText = reminder.content?.trim() || reminder.note?.title || 'Untitled reminder';
    const noteTitle = reminder.note?.title || 'Untitled note';
    const showNoteTitle = Boolean(reminder.content?.trim() && reminder.note?.title);
    const timeRemaining = getTimeRemaining(reminder.reminderDate);
    const reminderDateText = formatReminderDate(reminder.reminderDate);

    return (
        <div className="surface-base flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
                <Checkbox
                    checked={reminder.completed}
                    onChange={() => onUpdate(reminder.id, noteId, { completed: !reminder.completed })}
                    size="sm"
                />
                <div className="min-w-0 flex-1">
                    <Text
                        as="p"
                        variant="body"
                        weight="semibold"
                        className={reminder.completed ? 'truncate line-through opacity-45' : 'truncate'}
                    >
                        {primaryText}
                    </Text>
                    {showNoteTitle && (
                        <Text
                            as="div"
                            variant="meta"
                            tone="secondary"
                            className={reminder.completed ? 'mt-0.5 truncate opacity-45' : 'mt-0.5 truncate'}
                        >
                            <Link
                                to={NOTE_ROUTE}
                                params={{ id: String(reminder.note?.id ?? reminder.noteId) }}
                                className="transition-colors hover:text-fg-default hover:underline"
                            >
                                {noteTitle}
                            </Link>
                        </Text>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:shrink-0">
                <span
                    className={`h-3 w-3 shrink-0 rounded-full border border-border-subtle ${priorityToneClassName}`}
                    aria-label={`${priorityLabel} priority`}
                    title={`${priorityLabel} priority`}
                />
                <Text
                    as="span"
                    variant="meta"
                    weight="medium"
                    tone="secondary"
                    className={reminder.completed ? 'opacity-45' : undefined}
                >
                    {reminderDateText}
                </Text>
                <span className="h-1 w-1 rounded-full bg-border-secondary" />
                <Text
                    as="span"
                    variant="label"
                    weight="medium"
                    className={reminder.completed ? 'opacity-45' : detailToneClassName}
                >
                    {timeRemaining}
                </Text>
            </div>

            <div className="flex items-center justify-end gap-1.5 sm:shrink-0">
                <Dropdown
                    button={<MoreButton label="Reminder actions" iconClassName="h-5 w-5 text-current" />}
                    items={[
                        {
                            name: 'Delete',
                            onClick: () => onDelete(reminder.id, noteId),
                        },
                    ]}
                />
            </div>
        </div>
    );
}
