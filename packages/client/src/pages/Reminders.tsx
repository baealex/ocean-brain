import { getRouteApi } from '@tanstack/react-router';
import { QueryBoundary } from '~/components/app';
import {
    Empty,
    PageLayout,
    Pagination,
    Skeleton
} from '~/components/shared';
import { Reminders as RemindersEntity } from '~/components/entities';
import { Text } from '~/components/ui';
import useReminderMutate from '~/hooks/resource/useReminderMutate';
import ReminderCard from '~/components/reminder/ReminderCard';
import { priorityColors } from '~/modules/color';
import { REMINDERS_ROUTE } from '~/modules/url';

const Route = getRouteApi(REMINDERS_ROUTE);
const priorityHints = [
    {
        label: 'High',
        className: priorityColors.high
    },
    {
        label: 'Medium',
        className: priorityColors.medium
    },
    {
        label: 'Low',
        className: priorityColors.low
    }
] as const;

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
                    <div className="flex flex-col gap-2.5">
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
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <Text as="p" variant="meta" weight="medium" tone="secondary">
                                        {totalCount === 1 ? '1 reminder' : `${totalCount} reminders`}
                                    </Text>
                                    <div className="flex flex-wrap items-center gap-3">
                                        {priorityHints.map(({ label, className }) => (
                                            <div key={label} className="flex items-center gap-1.5">
                                                <span
                                                    className={`h-2.5 w-2.5 rounded-full border border-border-subtle ${className}`}
                                                    aria-hidden="true"
                                                />
                                                <Text
                                                    as="span"
                                                    variant="label"
                                                    weight="medium"
                                                    tone="tertiary">
                                                    {label}
                                                </Text>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2.5">
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
                            </div>
                        );
                    }}
                />
            </QueryBoundary>
        </PageLayout>
    );
}
