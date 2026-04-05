import { getRouteApi } from '@tanstack/react-router';
import { QueryBoundary } from '~/components/app';
import {
    Empty,
    PageLayout,
    Pagination,
    Skeleton
} from '~/components/shared';
import { Reminders as RemindersEntity } from '~/components/entities';
import useReminderMutate from '~/hooks/resource/useReminderMutate';
import ReminderCard from '~/components/reminder/ReminderCard';
import { REMINDERS_ROUTE } from '~/modules/url';

const Route = getRouteApi(REMINDERS_ROUTE);

export default function Reminders() {
    const navigate = Route.useNavigate();
    const { page } = Route.useSearch();
    const { onUpdate, onDelete } = useReminderMutate();

    const limit = 25;

    return (
        <PageLayout
            title="Reminders"
            description="Manage all your note reminders in one place">
            <QueryBoundary
                fallback={(
                    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                        <Skeleton height="60px" />
                        <Skeleton height="60px" />
                        <Skeleton height="60px" />
                        <Skeleton height="60px" />
                    </div>
                )}
                errorTitle="Failed to load reminders"
                errorDescription="Retry loading the upcoming reminder list."
                resetKeys={[page, limit]}>
                <RemindersEntity
                    searchParams={{
                        offset: (page - 1) * limit,
                        limit
                    }}
                    render={({ reminders, totalCount }) => {
                        if (reminders.length === 0) {
                            return (
                                <Empty
                                    title="No upcoming reminders"
                                    description="Add reminders to your notes to see them here"
                                />
                            );
                        }
                        return (
                            <>
                                <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                                    {reminders.map((reminder) => (
                                        <ReminderCard
                                            key={reminder.id}
                                            reminder={reminder}
                                            onUpdate={onUpdate}
                                            onDelete={onDelete}
                                        />
                                    ))}
                                </div>
                                {totalCount && limit < totalCount && (
                                    <Pagination
                                        page={page}
                                        last={Math.ceil(totalCount / limit)}
                                        onChange={(nextPage) => {
                                            navigate({
                                                search: prev => ({
                                                    ...prev,
                                                    page: nextPage
                                                })
                                            });
                                        }}
                                    />
                                )}
                            </>
                        );
                    }}
                />
            </QueryBoundary>
        </PageLayout>
    );
}
