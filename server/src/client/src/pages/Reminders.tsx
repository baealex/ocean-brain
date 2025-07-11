import { Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';

import {
    Empty, FallbackRender, Pagination, Progress, Skeleton
} from '~/components/shared';
import { Reminders as RemindersComponent } from '~/components/entities';
import useReminderMutate from '~/hooks/resource/useReminderMutate';
import { getNoteURL } from '~/modules/url';
import ReminderCard from '~/components/reminder/ReminderCard';

export default function Reminders() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [showCompleted, setShowCompleted] = useState(false);
    const { onUpdate, onDelete } = useReminderMutate();

    const limit = 25;
    const page = Number(searchParams.get('page')) || 1;

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

    return (
        <>
            <Helmet>
                <title>Reminders - Ocean Brain</title>
            </Helmet>
            <div className="mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">Upcoming Reminders</h1>
                        <p className="text-gray-500 dark:text-zinc-400">Manage all your note reminders in one place</p>
                    </div>
                    <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="px-3 py-2 rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors text-sm">
                        {showCompleted ? 'Hide Completed' : 'Show Completed'}
                    </button>
                </div>
            </div>
            <Suspense
                fallback={(
                    <div className="flex flex-col gap-4">
                        <Skeleton height="60px" />
                        <Skeleton height="60px" />
                        <Skeleton height="60px" />
                    </div>
                )}>
                <RemindersComponent
                    searchParams={{
                        offset: (page - 1) * limit,
                        limit
                    }}
                    render={({ reminders, totalCount }) => {
                        const filteredReminders = showCompleted
                            ? reminders
                            : reminders.filter(r => !r.completed);

                        const overdueReminders = filteredReminders.filter(r => {
                            const date = dayjs(Number(r.reminderDate));
                            const now = dayjs();
                            return date.isBefore(now) && !r.completed;
                        });

                        const completedCount = reminders.filter(r => r.completed).length;

                        const calculateUrgency = (dateString: string) => {
                            const date = dayjs(Number(dateString));
                            const now = dayjs();
                            const diffHours = date.diff(now, 'hour');

                            if (diffHours <= 6) return 'high';
                            if (diffHours <= 24) return 'medium';
                            return 'low';
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

                        const urgentReminders = filteredReminders.filter(r => {
                            const date = dayjs(Number(r.reminderDate));
                            const now = dayjs();
                            return !date.isBefore(now) && !r.completed &&
                                (r.priority === 'high' || calculateUrgency(r.reminderDate) === 'high');
                        });

                        const mediumReminders = filteredReminders.filter(r => {
                            const date = dayjs(Number(r.reminderDate));
                            const now = dayjs();
                            return !date.isBefore(now) && !r.completed &&
                                (r.priority === 'medium' || calculateUrgency(r.reminderDate) === 'medium');
                        });

                        const lowReminders = filteredReminders.filter(r => {
                            const date = dayjs(Number(r.reminderDate));
                            const now = dayjs();
                            return !date.isBefore(now) && !r.completed &&
                                (r.priority === 'low' || calculateUrgency(r.reminderDate) === 'low');
                        });

                        const completedReminders = filteredReminders.filter(r => r.completed);

                        return (
                            <FallbackRender
                                fallback={(
                                    <Empty
                                        icon="🔔"
                                        title="No upcoming reminders"
                                        description="Add reminders to your notes to see them here"
                                    />
                                )}>
                                {reminders.length > 0 && (
                                    <>
                                        {reminders.length > 0 && (
                                            <div className="mb-6">
                                                <div className="flex justify-between text-sm text-gray-500 dark:text-zinc-400 mb-1">
                                                    <span>Overall Progress</span>
                                                    <span>{completedCount} of {reminders.length} completed</span>
                                                </div>
                                                <Progress value={completedCount} max={reminders.length} />
                                            </div>
                                        )}

                                        <div className="flex flex-col gap-6">
                                            {overdueReminders.length > 0 && (
                                                <div>
                                                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                                        <span className="inline-block w-3 h-3 rounded-full bg-red-700" />
                                                        Overdue
                                                        <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-2 py-0.5 rounded-full">
                                                            {overdueReminders.length}
                                                        </span>
                                                    </h2>
                                                    <div className="flex flex-col gap-3">
                                                        {overdueReminders.map(reminder => (
                                                            <ReminderCard
                                                                key={reminder.id}
                                                                reminder={reminder}
                                                                urgency="high"
                                                                timeRemaining={getTimeRemaining(reminder.reminderDate)}
                                                                formatReminderDate={formatReminderDate}
                                                                onUpdate={onUpdate}
                                                                onDelete={onDelete}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {urgentReminders.length > 0 && (
                                                <div>
                                                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                                        <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
                                                        Urgent
                                                    </h2>
                                                    <div className="flex flex-col gap-3">
                                                        {urgentReminders.map(reminder => (
                                                            <ReminderCard
                                                                key={reminder.id}
                                                                reminder={reminder}
                                                                urgency="high"
                                                                timeRemaining={getTimeRemaining(reminder.reminderDate)}
                                                                formatReminderDate={formatReminderDate}
                                                                onUpdate={onUpdate}
                                                                onDelete={onDelete}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {mediumReminders.length > 0 && (
                                                <div>
                                                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                                        <span className="inline-block w-3 h-3 rounded-full bg-yellow-500" />
                                                        Today
                                                    </h2>
                                                    <div className="flex flex-col gap-3">
                                                        {mediumReminders.map(reminder => (
                                                            <ReminderCard
                                                                key={reminder.id}
                                                                reminder={reminder}
                                                                urgency="medium"
                                                                timeRemaining={getTimeRemaining(reminder.reminderDate)}
                                                                formatReminderDate={formatReminderDate}
                                                                onUpdate={onUpdate}
                                                                onDelete={onDelete}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {lowReminders.length > 0 && (
                                                <div>
                                                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                                        <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                                                        Upcoming
                                                    </h2>
                                                    <div className="flex flex-col gap-3">
                                                        {lowReminders.map(reminder => (
                                                            <ReminderCard
                                                                key={reminder.id}
                                                                reminder={reminder}
                                                                urgency="low"
                                                                timeRemaining={getTimeRemaining(reminder.reminderDate)}
                                                                formatReminderDate={formatReminderDate}
                                                                onUpdate={onUpdate}
                                                                onDelete={onDelete}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {showCompleted && completedReminders.length > 0 && (
                                                <div>
                                                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                                        <span className="inline-block w-3 h-3 rounded-full bg-gray-400 dark:bg-zinc-500" />
                                                        Completed
                                                    </h2>
                                                    <div className="flex flex-col gap-3">
                                                        {completedReminders.map(reminder => (
                                                            <div
                                                                key={reminder.id}
                                                                className="flex justify-between items-center p-4 border rounded-lg border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800">
                                                                <div className="flex flex-col">
                                                                    <Link
                                                                        to={getNoteURL(reminder.note?.id || '')}
                                                                        className="font-semibold hover:underline text-gray-500 dark:text-zinc-400">
                                                                        <span className="line-through">{reminder.note?.title || 'Untitled Note'}</span>
                                                                    </Link>
                                                                    <span className="text-sm text-gray-400 dark:text-zinc-500 line-through">
                                                                        {formatReminderDate(reminder.reminderDate)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => onUpdate(reminder.id, reminder.noteId.toString(), { completed: false })}
                                                                        className="px-3 py-1 bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded-md text-sm hover:bg-gray-200 dark:hover:bg-zinc-600">
                                                                        Restore
                                                                    </button>
                                                                    <button
                                                                        onClick={() => onDelete(reminder.id, reminder.noteId.toString())}
                                                                        className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-md text-sm hover:bg-red-200 dark:hover:bg-red-800/40">
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                                <FallbackRender fallback={null}>
                                    {totalCount && limit < totalCount && (
                                        <Pagination
                                            page={page}
                                            last={Math.ceil(totalCount / limit)}
                                            onChange={(page) => {
                                                setSearchParams(searchParams => {
                                                    searchParams.set('page', page.toString());
                                                    return searchParams;
                                                });
                                            }}
                                        />
                                    )}
                                </FallbackRender>
                            </FallbackRender>
                        );
                    }}
                />
            </Suspense>
        </>
    );
}
