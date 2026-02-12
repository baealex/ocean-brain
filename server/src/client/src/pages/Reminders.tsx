import { Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Empty, FallbackRender, Pagination, Skeleton } from '~/components/shared';
import { Reminders as RemindersEntity } from '~/components/entities';
import useReminderMutate from '~/hooks/resource/useReminderMutate';
import ReminderCard from '~/components/reminder/ReminderCard';

export default function Reminders() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { onUpdate, onDelete } = useReminderMutate();

    const limit = 25;
    const page = Number(searchParams.get('page')) || 1;

    return (
        <>
            <Helmet>
                <title>Reminders - Ocean Brain</title>
            </Helmet>
            <div className="mb-6 p-4 sketchy-sm shadow-sketchy bg-surface/80">
                <h1 className="text-2xl font-bold">Upcoming Reminders</h1>
                <p className="text-fg-tertiary text-sm">Manage all your note reminders in one place</p>
            </div>
            <Suspense
                fallback={(
                    <div className="flex flex-col gap-4">
                        <Skeleton height="60px" />
                        <Skeleton height="60px" />
                        <Skeleton height="60px" />
                    </div>
                )}>
                <RemindersEntity
                    searchParams={{
                        offset: (page - 1) * limit,
                        limit
                    }}
                    render={({ reminders, totalCount }) => {
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
                                    <div className="flex flex-col gap-4">
                                        {reminders.map((reminder) => (
                                            <ReminderCard
                                                key={reminder.id}
                                                reminder={reminder}
                                                onUpdate={onUpdate}
                                                onDelete={onDelete}
                                            />
                                        ))}
                                    </div>
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
