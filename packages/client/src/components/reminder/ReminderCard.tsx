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
    onEdit?: (reminder: Reminder) => void;
}

export default function ReminderCard({ reminder, onUpdate, onDelete, onEdit }: ReminderCardProps) {
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

    const timeRemaining = reminder.completed ? 'Completed' : getTimeRemaining(reminder.reminderDate);
    const isOverdue = timeRemaining === 'Overdue';
    const priority = reminder.priority || 'low';
    const priorityLabel = priority === 'high' ? 'High' : priority === 'medium' ? 'Medium' : 'Low';
    const priorityToneClassName = priorityColors[priority];
    const noteId = reminder.noteId.toString();
    const detailToneClassName = isOverdue ? 'text-fg-error' : 'text-fg-tertiary';
    const reminderContent = reminder.content?.trim();
    const primaryText = reminderContent || reminder.note?.title || 'Untitled reminder';
    const noteTitle = reminder.note?.title || 'Untitled note';
    const showNoteTitle = Boolean(reminderContent && reminder.note?.title);
    const reminderDateText = formatReminderDate(reminder.reminderDate);
    const managementActions = [
        ...(!reminder.completed && onEdit
            ? [
                  {
                      name: 'Edit',
                      onClick: () => onEdit(reminder),
                  },
              ]
            : []),
        ...(reminder.completed
            ? [
                  {
                      name: 'Reopen',
                      onClick: () => onUpdate(reminder.id, noteId, { completed: false }),
                  },
              ]
            : []),
    ];
    const actionItems = [
        ...managementActions,
        ...(managementActions.length > 0 ? [{ type: 'separator' as const, key: 'destructive-actions' }] : []),
        {
            name: 'Delete',
            onClick: () => onDelete(reminder.id, noteId),
        },
    ];

    return (
        <div className="surface-base grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2.5 gap-y-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-x-4 sm:gap-y-0">
            <Checkbox
                checked={reminder.completed}
                onChange={() => onUpdate(reminder.id, noteId, { completed: !reminder.completed })}
                size="sm"
                aria-label={`${reminder.completed ? 'Reopen' : 'Complete'} reminder: ${primaryText}`}
            />
            <div className="min-w-0">
                <Text
                    as="p"
                    variant="body"
                    weight="semibold"
                    className={reminder.completed ? 'truncate text-fg-tertiary line-through' : 'truncate'}
                >
                    {!reminderContent && reminder.note ? (
                        <Link
                            to={NOTE_ROUTE}
                            params={{ id: String(reminder.note.id) }}
                            className="transition-colors hover:text-fg-default hover:underline"
                        >
                            {primaryText}
                        </Link>
                    ) : (
                        primaryText
                    )}
                </Text>
                {showNoteTitle && (
                    <Text
                        as="div"
                        variant="meta"
                        tone="secondary"
                        className={reminder.completed ? 'mt-0.5 truncate text-fg-tertiary' : 'mt-0.5 truncate'}
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

            <div className="col-start-2 row-start-2 flex flex-wrap items-center gap-x-2 gap-y-1 sm:col-start-auto sm:row-start-auto sm:shrink-0">
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
                    className={reminder.completed ? 'text-fg-tertiary' : undefined}
                >
                    {reminderDateText}
                </Text>
                <span className="h-1 w-1 rounded-full bg-border-secondary" />
                <Text
                    as="span"
                    variant="label"
                    weight="medium"
                    className={reminder.completed ? 'text-accent-success' : detailToneClassName}
                >
                    {timeRemaining}
                </Text>
            </div>

            <div className="col-start-3 row-start-1 flex items-center justify-end gap-1.5 sm:col-start-auto sm:row-start-auto sm:shrink-0">
                <Dropdown
                    button={<MoreButton label="Reminder actions" iconClassName="h-5 w-5 text-current" />}
                    items={actionItems}
                />
            </div>
        </div>
    );
}
