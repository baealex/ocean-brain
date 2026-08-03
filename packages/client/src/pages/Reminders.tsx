import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

import { fetchOpenReminderOverview, fetchReminders, type ReminderListFilter } from '~/apis/reminder.api';
import { QueryBoundary } from '~/components/app';
import * as Icon from '~/components/icon';
import ReminderCard from '~/components/reminder/ReminderCard';
import ReminderModal from '~/components/reminder/ReminderModal';
import { Empty, PageLayout, Pagination, Skeleton } from '~/components/shared';
import { Button, Select, SelectItem, Text, ToggleGroup, ToggleGroupItem, useConfirm } from '~/components/ui';
import useReminderMutate from '~/hooks/resource/useReminderMutate';
import type { Reminder, Reminders as ReminderCollection, ReminderPriority } from '~/models/reminder.model';
import { queryKeys } from '~/modules/query-key-factory';
import type { ReminderRouteSearch } from '~/modules/route-search';
import { REMINDERS_ROUTE } from '~/modules/url';

const Route = getRouteApi(REMINDERS_ROUTE);
const PAGE_LIMIT = 25;
const OVERVIEW_LIMIT = 5;

type ReminderScope = Exclude<ReminderRouteSearch['scope'], 'all'>;

interface TimeBoundaries {
    now: string;
    tomorrow: string;
}

interface ReminderActions {
    onUpdate: (id: string, noteId: string, data: { completed?: boolean }) => void;
    onDelete: (id: string, noteId: string) => void;
    onEdit: (reminder: Reminder) => void;
}

const scopeDetails: Record<ReminderScope, { title: string; description: string; empty: string }> = {
    overdue: {
        title: 'Overdue',
        description: 'Recently missed reminders that still need a decision.',
        empty: 'Nothing overdue',
    },
    today: {
        title: 'Today',
        description: 'Open reminders due before the day ends.',
        empty: 'Nothing else due today',
    },
    upcoming: {
        title: 'Upcoming',
        description: 'Reminders scheduled after today.',
        empty: 'Nothing upcoming',
    },
};

const getPriority = (priority: ReminderRouteSearch['priority']) =>
    priority === 'all' ? undefined : (priority as ReminderPriority);

const buildOpenFilter = (
    scope: ReminderScope,
    priority: ReminderRouteSearch['priority'],
    boundaries: TimeBoundaries,
): ReminderListFilter => {
    const baseFilter = {
        status: 'open' as const,
        ...(getPriority(priority) ? { priority: getPriority(priority) } : {}),
        sortBy: 'reminderDate' as const,
    };

    if (scope === 'overdue') {
        return {
            ...baseFilter,
            end: boundaries.now,
            sortOrder: 'desc',
        };
    }

    if (scope === 'today') {
        return {
            ...baseFilter,
            start: boundaries.now,
            end: boundaries.tomorrow,
            sortOrder: 'asc',
        };
    }

    return {
        ...baseFilter,
        start: boundaries.tomorrow,
        sortOrder: 'asc',
    };
};

function ReminderListSkeleton() {
    return (
        <div role="status" aria-label="Loading reminders" className="flex flex-col gap-2.5">
            <Skeleton height="72px" />
            <Skeleton height="72px" />
            <Skeleton height="72px" />
        </div>
    );
}

function ReminderCards({ reminders, actions }: { reminders: Reminder[]; actions: ReminderActions }) {
    return (
        <div className="flex flex-col gap-2.5">
            {reminders.map((reminder) => (
                <ReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    onUpdate={actions.onUpdate}
                    onDelete={actions.onDelete}
                    onEdit={actions.onEdit}
                />
            ))}
        </div>
    );
}

function ReminderOverviewSection({
    scope,
    collection,
    actions,
    onViewAll,
}: {
    scope: ReminderScope;
    collection: ReminderCollection;
    actions: ReminderActions;
    onViewAll: (scope: ReminderScope) => void;
}) {
    const detail = scopeDetails[scope];
    const headingId = `reminder-${scope}-heading`;

    return (
        <section aria-labelledby={headingId} className="border-b border-border-subtle pb-5 last:border-b-0 last:pb-0">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <Text as="h2" id={headingId} variant="body" weight="bold">
                            {detail.title}
                        </Text>
                        <Text
                            as="span"
                            variant="label"
                            weight="semibold"
                            tone="tertiary"
                            className="rounded-full bg-hover-subtle px-2 py-0.5"
                        >
                            {collection.totalCount}
                        </Text>
                    </div>
                    <Text as="p" variant="meta" tone="tertiary" className="mt-0.5">
                        {detail.description}
                    </Text>
                </div>
                {collection.totalCount > OVERVIEW_LIMIT ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => onViewAll(scope)}>
                        View all
                        <Icon.ArrowRight className="size-3.5" aria-hidden="true" />
                    </Button>
                ) : null}
            </div>

            {collection.reminders.length > 0 ? (
                <ReminderCards reminders={collection.reminders} actions={actions} />
            ) : (
                <div className="rounded-[16px] border border-dashed border-border-subtle px-4 py-4">
                    <Text as="p" variant="meta" weight="medium" tone="tertiary">
                        {detail.empty}
                    </Text>
                </div>
            )}
        </section>
    );
}

function OpenReminderOverview({
    priority,
    boundaries,
    actions,
    onViewAll,
}: {
    priority: ReminderRouteSearch['priority'];
    boundaries: TimeBoundaries;
    actions: ReminderActions;
    onViewAll: (scope: ReminderScope) => void;
}) {
    const queryParams = {
        now: boundaries.now,
        tomorrow: boundaries.tomorrow,
        priority: getPriority(priority),
        limit: OVERVIEW_LIMIT,
    };
    const { data } = useSuspenseQuery({
        queryKey: queryKeys.reminders.overview(queryParams),
        queryFn: async () => {
            const response = await fetchOpenReminderOverview(queryParams);
            if (response.type === 'error') throw response;

            return {
                overdue: response.overdue,
                today: response.today,
                upcoming: response.upcoming,
            };
        },
    });
    const totalCount = data.overdue.totalCount + data.today.totalCount + data.upcoming.totalCount;

    if (totalCount === 0) {
        return (
            <Empty
                title="No open reminders"
                description={
                    priority === 'all'
                        ? 'Add a reminder inside any note to see it here.'
                        : 'Try another priority or add a matching reminder.'
                }
            />
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <ReminderOverviewSection
                scope="overdue"
                collection={data.overdue}
                actions={actions}
                onViewAll={onViewAll}
            />
            <ReminderOverviewSection scope="today" collection={data.today} actions={actions} onViewAll={onViewAll} />
            <ReminderOverviewSection
                scope="upcoming"
                collection={data.upcoming}
                actions={actions}
                onViewAll={onViewAll}
            />
        </div>
    );
}

function PaginatedReminderList({
    status,
    scope,
    priority,
    page,
    boundaries,
    actions,
    onPageChange,
    onBackToOverview,
}: {
    status: ReminderRouteSearch['status'];
    scope: ReminderRouteSearch['scope'];
    priority: ReminderRouteSearch['priority'];
    page: number;
    boundaries: TimeBoundaries;
    actions: ReminderActions;
    onPageChange: (page: number) => void;
    onBackToOverview: () => void;
}) {
    const filter: ReminderListFilter =
        status === 'completed'
            ? {
                  status: 'completed',
                  ...(getPriority(priority) ? { priority: getPriority(priority) } : {}),
                  sortBy: 'updatedAt',
                  sortOrder: 'desc',
              }
            : buildOpenFilter(scope as ReminderScope, priority, boundaries);
    const queryParams = {
        filter,
        limit: PAGE_LIMIT,
        offset: (page - 1) * PAGE_LIMIT,
    };
    const { data } = useSuspenseQuery({
        queryKey: queryKeys.reminders.list(queryParams),
        queryFn: async () => {
            const response = await fetchReminders(queryParams);
            if (response.type === 'error') throw response;
            return response.reminders;
        },
    });
    const lastPage = Math.max(1, Math.ceil(data.totalCount / PAGE_LIMIT));

    useEffect(() => {
        if (page > lastPage) onPageChange(lastPage);
    }, [lastPage, onPageChange, page]);

    const detail = status === 'completed' ? null : scopeDetails[scope as ReminderScope];
    const title = status === 'completed' ? 'Completed' : (detail?.title ?? 'Open reminders');

    return (
        <section aria-labelledby="reminder-list-heading">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                    {status === 'open' ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="-ml-3 mb-1"
                            onClick={onBackToOverview}
                        >
                            <Icon.ArrowLeft className="size-3.5" aria-hidden="true" />
                            All open reminders
                        </Button>
                    ) : null}
                    <div className="flex items-center gap-2">
                        <Text as="h2" id="reminder-list-heading" variant="body" weight="bold">
                            {title}
                        </Text>
                        <Text
                            as="span"
                            variant="label"
                            weight="semibold"
                            tone="tertiary"
                            className="rounded-full bg-hover-subtle px-2 py-0.5"
                        >
                            {data.totalCount}
                        </Text>
                    </div>
                    <Text as="p" variant="meta" tone="tertiary" className="mt-0.5">
                        {status === 'completed'
                            ? 'Completed reminders can be reopened or permanently deleted.'
                            : detail?.description}
                    </Text>
                </div>
                {data.totalCount > 0 ? (
                    <Text as="span" variant="label" tone="tertiary">
                        {Math.min(queryParams.offset + 1, data.totalCount)}–
                        {Math.min(queryParams.offset + data.reminders.length, data.totalCount)} of {data.totalCount}
                    </Text>
                ) : null}
            </div>

            {data.reminders.length > 0 ? (
                <>
                    <ReminderCards reminders={data.reminders} actions={actions} />
                    {lastPage > 1 ? <Pagination page={page} last={lastPage} onChange={onPageChange} /> : null}
                </>
            ) : (
                <Empty
                    title={status === 'completed' ? 'No completed reminders' : detail?.empty}
                    description={
                        priority === 'all'
                            ? 'There is nothing to manage in this list yet.'
                            : 'Try another priority to see more reminders.'
                    }
                />
            )}
        </section>
    );
}

export default function Reminders() {
    const navigate = Route.useNavigate();
    const { status, scope, priority, page } = Route.useSearch();
    const { onUpdate, onDelete } = useReminderMutate();
    const confirm = useConfirm();
    const [editingReminder, setEditingReminder] = useState<Reminder>();
    const [boundaries] = useState<TimeBoundaries>(() => {
        const now = dayjs();
        return {
            now: now.toISOString(),
            tomorrow: now.add(1, 'day').startOf('day').toISOString(),
        };
    });

    const setPage = (nextPage: number) => {
        navigate({
            search: (prev) => ({
                ...prev,
                page: nextPage,
            }),
        });
    };
    const handleDelete = async (id: string, noteId: string) => {
        if (await confirm('Delete this reminder? This cannot be undone.')) {
            await onDelete(id, noteId);
        }
    };
    const actions: ReminderActions = {
        onUpdate,
        onDelete: handleDelete,
        onEdit: setEditingReminder,
    };
    const controls = (
        <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
                type="single"
                variant="quiet"
                size="sm"
                value={status}
                onValueChange={(value) => {
                    if (!value) return;
                    navigate({
                        search: (prev) => ({
                            ...prev,
                            status: value as ReminderRouteSearch['status'],
                            scope: 'all',
                            page: 1,
                        }),
                    });
                }}
            >
                <ToggleGroupItem value="open">Open</ToggleGroupItem>
                <ToggleGroupItem value="completed">Completed</ToggleGroupItem>
            </ToggleGroup>
            <Select
                value={priority}
                size="sm"
                ariaLabel="Filter reminders by priority"
                className="w-[148px]"
                onValueChange={(value) => {
                    navigate({
                        search: (prev) => ({
                            ...prev,
                            priority: value as ReminderRouteSearch['priority'],
                            page: 1,
                        }),
                    });
                }}
            >
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="high">High priority</SelectItem>
                <SelectItem value="medium">Medium priority</SelectItem>
                <SelectItem value="low">Low priority</SelectItem>
            </Select>
        </div>
    );

    return (
        <>
            <PageLayout
                title="Reminders"
                description={
                    status === 'completed'
                        ? 'Review completed reminders and reopen anything that still needs attention.'
                        : 'Act on what is overdue, due today, and coming next.'
                }
                headerRight={controls}
            >
                <QueryBoundary
                    fallback={<ReminderListSkeleton />}
                    errorTitle="Failed to load reminders"
                    errorDescription="Retry loading the reminder workspace."
                    resetKeys={[status, scope, priority, page, boundaries.now]}
                >
                    {status === 'open' && scope === 'all' ? (
                        <OpenReminderOverview
                            priority={priority}
                            boundaries={boundaries}
                            actions={actions}
                            onViewAll={(nextScope) => {
                                navigate({
                                    search: (prev) => ({
                                        ...prev,
                                        scope: nextScope,
                                        page: 1,
                                    }),
                                });
                            }}
                        />
                    ) : (
                        <PaginatedReminderList
                            status={status}
                            scope={scope}
                            priority={priority}
                            page={page}
                            boundaries={boundaries}
                            actions={actions}
                            onPageChange={setPage}
                            onBackToOverview={() => {
                                navigate({
                                    search: (prev) => ({
                                        ...prev,
                                        scope: 'all',
                                        page: 1,
                                    }),
                                });
                            }}
                        />
                    )}
                </QueryBoundary>
            </PageLayout>

            <ReminderModal
                isOpen={Boolean(editingReminder)}
                mode="edit"
                reminder={editingReminder}
                onClose={() => setEditingReminder(undefined)}
                onSave={(date, nextPriority, content) => {
                    if (!editingReminder) return;
                    onUpdate(editingReminder.id, String(editingReminder.noteId), {
                        reminderDate: date,
                        priority: nextPriority,
                        content,
                    });
                }}
            />
        </>
    );
}
