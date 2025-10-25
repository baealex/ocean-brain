
import { Link } from 'react-router-dom';
import type { Reminder } from '~/models/reminder.model';
import { getNoteURL } from '~/modules/url';
import styles from './ReminderCard.module.scss';
import dayjs from 'dayjs';

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
    const urgencyColors: Record<string, string> = {
        low: 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20',
        medium: 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20',
        high: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
    };

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

    return (
        <div className={`flex justify-between items-center p-4 border-l-4 border rounded-lg ${urgencyColors[reminder.priority || 'low']} ${reminder.priority === 'high' ? styles.priorityHigh : reminder.priority === 'medium' ? styles.priorityMedium : ''}`}>
            <div className="flex flex-col">
                <Link to={getNoteURL(reminder.note?.id || '')} className="font-semibold hover:underline flex items-center gap-2">
                    {reminder.note?.title || 'Untitled Note'}
                </Link>
                {reminder.content && (
                    <p className="text-sm text-gray-700 dark:text-zinc-300 mt-1 mb-1">
                        {reminder.content}
                    </p>
                )}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-zinc-400">
                        {formatReminderDate(reminder.reminderDate)}
                    </span>
                    <span
                        className={`text-xs font-medium ${
                            isOverdue
                                ? `text-red-600 dark:text-red-400 ${styles.urgentPulsing}`
                                : 'text-gray-500 dark:text-zinc-400'
                        }`}>
                        {getTimeRemaining(reminder.reminderDate)}
                    </span>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => onUpdate(reminder.id, reminder.noteId.toString(), { completed: true })} className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm hover:bg-green-200 dark:hover:bg-green-800/40">
                    Complete
                </button>
                <button onClick={() => onDelete(reminder.id, reminder.noteId.toString())} className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-md text-sm hover:bg-red-200 dark:hover:bg-red-800/40">
                    Delete
                </button>
            </div>
        </div>
    );
}
