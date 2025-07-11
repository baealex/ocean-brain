
import { Link } from 'react-router-dom';
import type { Reminder } from '~/models/reminder.model';
import { getNoteURL } from '~/modules/url';
import styles from './ReminderCard.module.scss';

interface ReminderCardProps {
    reminder: Reminder;
    urgency: 'low' | 'medium' | 'high';
    timeRemaining: string;
    formatReminderDate: (date: string) => string;
    onUpdate: (id: string, noteId: string, data: { completed?: boolean }) => void;
    onDelete: (id: string, noteId: string) => void;
}

export default function ReminderCard({
    reminder,
    urgency,
    timeRemaining,
    formatReminderDate,
    onUpdate,
    onDelete
}: ReminderCardProps) {
    const urgencyColors: Record<string, string> = {
        low: 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20',
        medium: 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20',
        high: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
    };

    const urgencyIcons: Record<string, string> = {
        low: '🟢',
        medium: '🟠',
        high: '🔴'
    };

    const isUrgent = urgency === 'high';
    const isOverdue = timeRemaining === 'Overdue';

    return (
        <div className={`flex justify-between items-center p-4 border-l-4 border rounded-lg ${urgencyColors[urgency]} ${urgency === 'high' ? styles.priorityHigh : urgency === 'medium' ? styles.priorityMedium : ''}`}>
            <div className="flex flex-col">
                <Link to={getNoteURL(reminder.note?.id || '')} className="font-semibold hover:underline flex items-center gap-2">
                    <span className="inline-block w-5">{urgencyIcons[urgency]}</span>
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
                                : isUrgent
                                    ? `text-red-500 dark:text-red-400 ${styles.pulsing}`
                                    : 'text-gray-500 dark:text-zinc-400'
                        }`}>
                        {timeRemaining}
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
