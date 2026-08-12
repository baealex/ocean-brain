import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { NotePropertyKeySummary } from '~/apis/note.api';
import { fetchViewSectionNotes } from '~/apis/view.api';
import { Dropdown, Pagination, SurfaceCard } from '~/components/shared';
import { MoreButton, Text } from '~/components/ui';
import type { ViewSection, ViewSortBy, ViewSortOrder } from '~/models/view.model';
import { queryKeys } from '~/modules/query-key-factory';
import { formatViewPropertyFilter, getViewDisplayTypeLabel, getViewTagMatchToken } from '~/modules/view-dashboard';
import type { ViewSectionRouteState, ViewSectionRouteStateUpdater } from '~/modules/view-route-state';
import ViewChip from './ViewChip';
import ViewSectionRenderer from './ViewSectionRenderer';

interface ViewSectionCardProps {
    section: ViewSection;
    onEdit: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    dragHandle?: React.ReactNode;
    availableProperties?: NotePropertyKeySummary[];
    isPropertiesLoading?: boolean;
    navigationState?: ViewSectionRouteState;
    onNavigationStateChange?: (updater: ViewSectionRouteStateUpdater) => void;
}

export default function ViewSectionCard({
    section,
    onEdit,
    onDuplicate,
    onDelete,
    onMoveUp,
    onMoveDown,
    dragHandle,
    availableProperties = [],
    isPropertiesLoading = false,
    navigationState = {},
    onNavigationStateChange = () => undefined,
}: ViewSectionCardProps) {
    const isBoard = section.displayType === 'board';
    const isCalendar = section.displayType === 'calendar';
    const page = navigationState.page ?? 1;
    const offset = (page - 1) * section.limit;
    const sortBy = navigationState.sort?.by ?? section.sortBy;
    const sortOrder = navigationState.sort?.order ?? section.sortOrder;

    const { data, isPending, isError, isPlaceholderData, refetch } = useQuery({
        queryKey: queryKeys.views.sectionNotes(section.id, {
            limit: section.limit,
            offset,
            sortBy,
            sortOrder,
        }),
        enabled: !isBoard && !isCalendar,
        placeholderData: keepPreviousData,
        async queryFn() {
            const response = await fetchViewSectionNotes(section.id, {
                limit: section.limit,
                offset,
                sortBy,
                sortOrder,
            });

            if (response.type === 'error') {
                throw response;
            }

            return response.viewSectionNotes;
        },
    });

    const notes = data?.notes ?? [];
    const totalCount = data?.totalCount ?? 0;
    const lastPage = Math.max(1, Math.ceil(totalCount / section.limit));
    const tagMatchToken = getViewTagMatchToken(section.mode);
    const hasFilters = section.tagNames.length > 0 || section.propertyFilters.length > 0;
    const boardGroupProperty = isBoard
        ? availableProperties.find((property) => property.key === section.displayOptions.boardGroupByPropertyKey)
        : null;

    const updateSectionSort = (nextSortBy: ViewSortBy) => {
        const nextSortOrder: ViewSortOrder =
            sortBy === nextSortBy ? (sortOrder === 'asc' ? 'desc' : 'asc') : nextSortBy === 'title' ? 'asc' : 'desc';

        onNavigationStateChange((current) => ({
            ...current,
            page: 1,
            sort: { by: nextSortBy, order: nextSortOrder },
        }));
    };

    useEffect(() => {
        if (isBoard || isCalendar || isPending || isError || isPlaceholderData || !data || page <= lastPage) {
            return;
        }

        onNavigationStateChange((current) => ({ ...current, page: lastPage }));
    }, [data, isBoard, isCalendar, isError, isPending, isPlaceholderData, lastPage, onNavigationStateChange, page]);

    return (
        <SurfaceCard flush className="flex h-full flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-border-subtle/75 px-4 py-3.5">
                <div className="min-w-0">
                    <div className="flex items-center gap-1">
                        {dragHandle && <div className="-mr-1 shrink-0 self-center">{dragHandle}</div>}
                        <div className="min-w-0">
                            <Text as="h2" variant="subheading" weight="semibold" tracking="tight" className="min-w-0">
                                <span className="truncate">{section.title}</span>
                            </Text>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        <ViewChip className="max-w-full border-border-subtle/80 bg-elevated text-fg-secondary">
                            {getViewDisplayTypeLabel(section.displayType)}
                        </ViewChip>
                        {isBoard && section.displayOptions.boardGroupByPropertyKey ? (
                            <ViewChip className="max-w-full border-border-subtle/80 bg-subtle text-fg-secondary">
                                Grouped by {boardGroupProperty?.name ?? section.displayOptions.boardGroupByPropertyKey}
                            </ViewChip>
                        ) : null}
                        {isCalendar ? (
                            <ViewChip className="max-w-full border-border-subtle/80 bg-subtle text-fg-secondary">
                                {section.displayOptions.calendarDateField === 'updatedAt'
                                    ? 'Updated date'
                                    : 'Created date'}
                            </ViewChip>
                        ) : null}
                        {section.tagNames.map((tagName, index) => (
                            <div key={tagName} className="flex min-w-0 items-center gap-1.5">
                                {index > 0 && (
                                    <span className="px-0.5 text-[10px] font-semibold tracking-[0.08em] text-fg-tertiary/85">
                                        {tagMatchToken}
                                    </span>
                                )}
                                <ViewChip className="max-w-full border-border-subtle/80 bg-transparent text-fg-secondary">
                                    {tagName}
                                </ViewChip>
                            </div>
                        ))}
                        {section.propertyFilters.map((filter) => (
                            <ViewChip
                                key={`${filter.key}-${filter.operator}-${filter.value ?? ''}`}
                                className="max-w-full border-border-subtle/80 bg-subtle text-fg-secondary"
                            >
                                {formatViewPropertyFilter(filter)}
                            </ViewChip>
                        ))}
                        {!hasFilters && (
                            <ViewChip className="max-w-full border-border-subtle/80 bg-transparent text-fg-tertiary">
                                All notes
                            </ViewChip>
                        )}
                    </div>
                </div>
                <Dropdown
                    button={<MoreButton label="Section actions" />}
                    items={[
                        ...(onMoveUp ? [{ name: 'Move up', onClick: onMoveUp }] : []),
                        ...(onMoveDown ? [{ name: 'Move down', onClick: onMoveDown }] : []),
                        ...(onMoveUp || onMoveDown ? [{ type: 'separator' as const }] : []),
                        {
                            name: 'Edit section',
                            onClick: onEdit,
                        },
                        {
                            name: 'Duplicate section',
                            onClick: onDuplicate,
                        },
                        { type: 'separator' },
                        {
                            name: 'Delete section',
                            onClick: onDelete,
                        },
                    ]}
                />
            </div>

            <div className="flex flex-1 flex-col">
                <ViewSectionRenderer
                    section={section}
                    notes={notes}
                    isPending={isPending}
                    isError={isError}
                    onRetry={() => void refetch()}
                    onEdit={onEdit}
                    onSortChange={updateSectionSort}
                    isSortPending={isPlaceholderData}
                    activeSortBy={sortBy}
                    activeSortOrder={sortOrder}
                    availableProperties={availableProperties}
                    isPropertiesLoading={isPropertiesLoading}
                    navigationState={navigationState}
                    onNavigationStateChange={onNavigationStateChange}
                />
            </div>

            {!isCalendar ? (
                <div className="flex flex-col gap-3 border-t border-border-subtle/75 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <Text as="p" variant="meta" tone="tertiary">
                        {isBoard
                            ? `${section.limit} cards per column load`
                            : isPending || isPlaceholderData
                              ? 'Loading notes...'
                              : totalCount === 0
                                ? 'No matching notes'
                                : `Showing ${offset + 1}–${Math.min(offset + notes.length, totalCount)} of ${totalCount} notes`}
                    </Text>
                    {!isBoard && lastPage > 1 ? (
                        <Pagination
                            page={Math.min(page, lastPage)}
                            last={lastPage}
                            className="!mt-0 shrink-0 sm:justify-end"
                            onChange={(nextPage) =>
                                onNavigationStateChange((current) => ({ ...current, page: nextPage }))
                            }
                        />
                    ) : null}
                </div>
            ) : null}
        </SurfaceCard>
    );
}
