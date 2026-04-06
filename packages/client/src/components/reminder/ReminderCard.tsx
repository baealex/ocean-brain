import { Link } from '@tanstack/react-router';
import dayjs from 'dayjs';

import * as Icon from '~/components/icon';
import { Button, Dropdown } from '~/components/shared';
import { Text } from '~/components/ui';
import type { Reminder } from '~/models/reminder.model';
import { priorityColorsSubtle } from '~/modules/color';
import { NOTE_ROUTE } from '~/modules/url';

interface ReminderCardProps {
    reminder: Reminder;
    onUpdate: (id: string, noteId: string, data: { completed?: boolean }) => void;
    onDelete: (id: string, noteId: string) => void;
}

export default function ReminderCard({
    reminder,
    onUpdate,
    onDelete
}: ReminderCardProps) {
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
    const priorityLabel = priority === 'high'
        ? 'High'
        : priority === 'medium'
            ? 'Medium'
            : 'Low';
    const priorityToneClassName = `${priorityColorsSubtle[priority]} text-fg-default`;
    const noteId = reminder.noteId.toString();
    const detailToneClassName = isOverdue ? 'text-fg-error' : 'text-fg-tertiary';
    const primaryText = reminder.content?.trim() || reminder.note?.title || 'Untitled reminder';
    const noteTitle = reminder.note?.title || 'Untitled note';

    return (
        <div className="surface-base flex flex-col gap-4 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <Text
                            as="span"
                            variant="label"
                            weight="medium"
                            tone="tertiary"
                            className="inline-flex shrink-0 items-center gap-1.5">
                            <span className={`h-2.5 w-2.5 rounded-full border border-border-subtle ${priorityToneClassName}`} />
                            {priorityLabel}
                        </Text>
                        <Text as="p" variant="body" weight="semibold" className="min-w-0 line-clamp-2">
                            {primaryText}
                        </Text>
                    </div>
                </div>
                <Dropdown
                    button={(
                        <button
                            type="button"
                            className="focus-ring-soft inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-transparent bg-transparent text-fg-tertiary outline-none transition-colors hover:border-border-subtle hover:bg-hover-subtle hover:text-fg-default">
                            <Icon.VerticalDots className="h-5 w-5 text-current" />
                            <span className="sr-only">Reminder actions</span>
                        </button>
                    )}
                    items={[
                        {
                            name: 'Delete',
                            onClick: () => onDelete(reminder.id, noteId)
                        }
                    ]}
                />
            </div>

            <Text as="div" variant="meta" tone="secondary" className="flex items-center gap-2">
                <Icon.File size={14} />
                <Link
                    to={NOTE_ROUTE}
                    params={{ id: String(reminder.note?.id ?? reminder.noteId) }}
                    className="truncate transition-colors hover:text-fg-default hover:underline">
                    {noteTitle}
                </Link>
            </Text>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <Text as="div" variant="meta" tone="secondary" className="flex flex-wrap items-center gap-2">
                    <Icon.Clock size={14} />
                    <Text as="span" variant="meta" weight="medium" tone="secondary">
                        {formatReminderDate(reminder.reminderDate)}
                    </Text>
                    <span className="h-1 w-1 rounded-full bg-border-secondary" />
                    <Text
                        as="span"
                        variant="label"
                        weight="medium"
                        className={detailToneClassName}>
                        {getTimeRemaining(reminder.reminderDate)}
                    </Text>
                </Text>
                <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => onUpdate(reminder.id, noteId, { completed: true })}>
                    <Icon.Check size={14} />
                    Complete
                </Button>
            </div>
        </div>
    );
}
