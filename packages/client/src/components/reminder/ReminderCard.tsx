import { Link } from 'react-router-dom';
import dayjs from 'dayjs';

import { Button } from '~/components/ui';
import type { Reminder } from '~/models/reminder.model';
import { priorityColors } from '~/modules/color';
import { getNoteURL } from '~/modules/url';
import styles from './ReminderCard.module.scss';

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
    const priorityClass = reminder.priority === 'high'
        ? styles.priorityHigh
        : reminder.priority === 'medium'
            ? styles.priorityMedium
            : '';

    return (
        <div className={`flex justify-between items-center p-4 border-2 rounded-[12px_4px_13px_3px/4px_10px_4px_12px] shadow-sketchy ${priorityColors[reminder.priority || 'low']} border-border-secondary ${priorityClass}`}>
            <div className="flex flex-col">
                <Link
                    to={getNoteURL(reminder.note?.id || '')}
                    className="font-bold hover:underline flex items-center gap-2 text-fg-default">
                    {reminder.note?.title || 'Untitled Note'}
                </Link>
                {reminder.content && (
                    <p className="text-sm text-fg-muted mt-1 mb-1 font-medium">
                        {reminder.content}
                    </p>
                )}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-fg-secondary font-medium">
                        {formatReminderDate(reminder.reminderDate)}
                    </span>
                    <span
                        className={`text-xs font-bold ${
                            isOverdue
                                ? `text-fg-error ${styles.urgentPulsing}`
                                : 'text-fg-tertiary'
                        }`}>
                        {getTimeRemaining(reminder.reminderDate)}
                    </span>
                </div>
            </div>
            <div className="flex gap-2">
                <Button
                    variant="soft-success"
                    size="sm"
                    onClick={() => onUpdate(reminder.id, reminder.noteId.toString(), { completed: true })}>
                    Complete
                </Button>
                <Button
                    variant="soft-danger"
                    size="sm"
                    onClick={() => onDelete(reminder.id, reminder.noteId.toString())}>
                    Delete
                </Button>
            </div>
        </div>
    );
}
