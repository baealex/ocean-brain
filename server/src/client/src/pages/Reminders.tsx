import { Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';

import { Empty, FallbackRender, Pagination, Skeleton } from '~/components/shared';
import { Reminders as RemindersComponent } from '~/components/entities';
import useReminderMutate from '~/hooks/resource/useReminderMutate';
import { getNoteURL } from '~/modules/url';

export default function Reminders() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { onUpdate, onDelete } = useReminderMutate();

    const limit = 25;
    const page = Number(searchParams.get('page')) || 1;

    const formatReminderDate = (dateString: string) => {
        const date = dayjs(dateString);
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
                <h1 className="text-2xl font-bold">Upcoming Reminders</h1>
                <p className="text-gray-500 dark:text-zinc-400">Manage all your note reminders in one place</p>
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
                    render={({ reminders, totalCount }) => (
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
                                    <div className="flex flex-col gap-3">
                                        {reminders.map(reminder => (
                                            <div
                                                key={reminder.id}
                                                className="flex justify-between items-center p-4 border rounded-lg border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                                                <div className="flex flex-col">
                                                    <Link
                                                        to={getNoteURL(reminder.note?.id || '')}
                                                        className="font-semibold hover:underline">
                                                        {reminder.note?.title || 'Untitled Note'}
                                                    </Link>
                                                    <span className="text-sm text-gray-500 dark:text-zinc-400">
                                                        {formatReminderDate(reminder.reminderDate)}
                                                    </span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => onUpdate(reminder.id, reminder.noteId.toString(), { completed: true })}
                                                        className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md text-sm hover:bg-green-200 dark:hover:bg-green-800/40">
                                                        Complete
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
                                </>
                            )}
                        </FallbackRender>
                    )}
                />
            </Suspense>
        </>
    );
}
