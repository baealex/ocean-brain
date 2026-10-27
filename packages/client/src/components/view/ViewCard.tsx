import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { NotePropertyKeySummary } from '~/apis/note.api';
import { fetchViewNotes } from '~/apis/view.api';
import * as Icon from '~/components/icon';
import { Dropdown, Pagination, SurfaceCard } from '~/components/shared';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
    MoreButton,
    Text,
} from '~/components/ui';
import type { View, ViewDisplayOptions, ViewSortBy, ViewSortOrder } from '~/models/view.model';
import { queryKeys } from '~/modules/query-key-factory';
import {
    formatViewPropertyFilter,
    getViewDisplayTypeLabel,
    getViewTagFilterMatchToken,
} from '~/modules/view-dashboard';
import type { ViewNavigationState, ViewRouteStateUpdater } from '~/modules/view-route-state';
import ViewChip from './ViewChip';
import ViewRenderer from './ViewRenderer';
import ViewTableColumnsDialog from './ViewTableColumnsDialog';

const SORT_CHOICES: { by: ViewSortBy; order: ViewSortOrder; label: string }[] = [
    { by: 'updatedAt', order: 'desc', label: 'Recently updated' },
    { by: 'updatedAt', order: 'asc', label: 'Least recently updated' },
    { by: 'createdAt', order: 'desc', label: 'Newest notes first' },
    { by: 'createdAt', order: 'asc', label: 'Oldest notes first' },
    { by: 'title', order: 'asc', label: 'Title: A to Z' },
    { by: 'title', order: 'desc', label: 'Title: Z to A' },
];

interface ViewCardProps {
    view: View;
    onEdit: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onSaveSort: (sortBy: ViewSortBy, sortOrder: ViewSortOrder) => Promise<void>;
    onSaveColumns: (options: ViewDisplayOptions) => Promise<boolean>;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    dragHandle?: React.ReactNode;
    availableProperties?: NotePropertyKeySummary[];
    isPropertiesLoading?: boolean;
    isPropertiesError?: boolean;
    onRetryProperties?: () => void;
    navigationState?: ViewNavigationState;
    onNavigationStateChange?: (updater: ViewRouteStateUpdater) => void;
}

export default function ViewCard({
    view,
    onEdit,
    onDuplicate,
    onDelete,
    onSaveSort,
    onSaveColumns,
    onMoveUp,
    onMoveDown,
    dragHandle,
    availableProperties = [],
    isPropertiesLoading = false,
    isPropertiesError = false,
    onRetryProperties = () => undefined,
    navigationState = {},
    onNavigationStateChange = () => undefined,
}: ViewCardProps) {
    const [isSavingSort, setIsSavingSort] = useState(false);
    const [isColumnsOpen, setIsColumnsOpen] = useState(false);
    const isBoard = view.displayType === 'board';
    const isCalendar = view.displayType === 'calendar';
    const page = navigationState.page ?? 1;
    const offset = (page - 1) * view.limit;
    const sortBy = navigationState.sort?.by ?? view.sortBy;
    const sortOrder = navigationState.sort?.order ?? view.sortOrder;
    const hasCustomSort = sortBy !== view.sortBy || sortOrder !== view.sortOrder;
    const sortLabel = SORT_CHOICES.find((choice) => choice.by === sortBy && choice.order === sortOrder)?.label;

    const { data, isPending, isError, isPlaceholderData, refetch } = useQuery({
        queryKey: queryKeys.views.viewNotes(view.id, {
            limit: view.limit,
            offset,
            sortBy,
            sortOrder,
        }),
        enabled: !isBoard && !isCalendar,
        placeholderData: keepPreviousData,
        async queryFn() {
            const response = await fetchViewNotes(view.id, {
                limit: view.limit,
                offset,
                sortBy,
                sortOrder,
            });

            if (response.type === 'error') {
                throw response;
            }

            return response.viewNotes;
        },
    });

    const notes = data?.notes ?? [];
    const totalCount = data?.totalCount ?? 0;
    const lastPage = Math.max(1, Math.ceil(totalCount / view.limit));
    const tagMatchToken = getViewTagFilterMatchToken(view.mode);
    const hasFilters = view.tagNames.length > 0 || view.propertyFilters.length > 0;
    const boardGroupProperty = isBoard
        ? availableProperties.find((property) => property.key === view.displayOptions.boardGroupByPropertyKey)
        : null;
    const calendarDateProperty = isCalendar
        ? availableProperties.find((property) => property.key === view.displayOptions.calendarDatePropertyKey)
        : null;
    const calendarDateLabel =
        view.displayOptions.calendarDateField === 'property'
            ? (calendarDateProperty?.name ?? view.displayOptions.calendarDatePropertyKey ?? 'Date property')
            : view.displayOptions.calendarDateField === 'updatedAt'
              ? 'Updated date'
              : 'Created date';

    const setViewSort = (nextSortBy: ViewSortBy, nextSortOrder: ViewSortOrder) => {
        onNavigationStateChange((current) => ({
            ...current,
            page: 1,
            sort:
                nextSortBy === view.sortBy && nextSortOrder === view.sortOrder
                    ? undefined
                    : { by: nextSortBy, order: nextSortOrder },
        }));
    };

    const updateViewSort = (nextSortBy: ViewSortBy) => {
        const nextSortOrder: ViewSortOrder =
            sortBy === nextSortBy ? (sortOrder === 'asc' ? 'desc' : 'asc') : nextSortBy === 'title' ? 'asc' : 'desc';

        setViewSort(nextSortBy, nextSortOrder);
    };

    const saveSort = async () => {
        setIsSavingSort(true);
        try {
            await onSaveSort(sortBy, sortOrder);
        } finally {
            setIsSavingSort(false);
        }
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
                                <span className="truncate">{view.title}</span>
                            </Text>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        <ViewChip className="max-w-full border-border-subtle/80 bg-elevated text-fg-secondary">
                            {getViewDisplayTypeLabel(view.displayType)}
                        </ViewChip>
                        {isBoard && view.displayOptions.boardGroupByPropertyKey ? (
                            <ViewChip className="max-w-full border-border-subtle/80 bg-subtle text-fg-secondary">
                                Grouped by {boardGroupProperty?.name ?? view.displayOptions.boardGroupByPropertyKey}
                            </ViewChip>
                        ) : null}
                        {isCalendar ? (
                            <ViewChip className="max-w-full border-border-subtle/80 bg-subtle text-fg-secondary">
                                {calendarDateLabel}
                            </ViewChip>
                        ) : null}
                        {view.tagNames.map((tagName, index) => (
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
                        {view.propertyFilters.map((filter) => (
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
                    button={<MoreButton label="View actions" />}
                    items={[
                        ...(onMoveUp ? [{ name: 'Move up', onClick: onMoveUp }] : []),
                        ...(onMoveDown ? [{ name: 'Move down', onClick: onMoveDown }] : []),
                        ...(onMoveUp || onMoveDown ? [{ type: 'separator' as const }] : []),
                        {
                            name: 'Edit view',
                            onClick: onEdit,
                        },
                        {
                            name: 'Duplicate view',
                            onClick: onDuplicate,
                        },
                        { type: 'separator' },
                        {
                            name: 'Delete view',
                            onClick: onDelete,
                        },
                    ]}
                />
            </div>

            {!isBoard && !isCalendar ? (
                <div
                    role="group"
                    aria-label={`${view.title} sort`}
                    className="flex flex-wrap items-center gap-2 border-b border-border-subtle/75 px-4 py-2"
                >
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                aria-label={`Sort: ${sortLabel}`}
                                disabled={isSavingSort}
                            >
                                {sortLabel}
                                <Icon.ChevronDown className="size-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuRadioGroup
                                value={`${sortBy}:${sortOrder}`}
                                onValueChange={(value) => {
                                    const choice = SORT_CHOICES.find(
                                        (candidate) => `${candidate.by}:${candidate.order}` === value,
                                    );
                                    if (choice) setViewSort(choice.by, choice.order);
                                }}
                            >
                                {SORT_CHOICES.map((choice) => (
                                    <DropdownMenuRadioItem
                                        key={`${choice.by}:${choice.order}`}
                                        value={`${choice.by}:${choice.order}`}
                                    >
                                        {choice.label}
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {view.displayType === 'table' ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsColumnsOpen(true)}
                            disabled={isSavingSort}
                        >
                            <Icon.Grid className="size-4" />
                            Columns
                        </Button>
                    ) : null}
                    {hasCustomSort ? (
                        <>
                            <Button
                                type="button"
                                variant="subtle"
                                size="sm"
                                isLoading={isSavingSort}
                                onClick={() => void saveSort()}
                            >
                                Save default sort
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={isSavingSort}
                                onClick={() => setViewSort(view.sortBy, view.sortOrder)}
                            >
                                Reset sort
                            </Button>
                        </>
                    ) : null}
                </div>
            ) : null}

            <div className="flex flex-1 flex-col">
                <ViewRenderer
                    view={view}
                    notes={notes}
                    isPending={isPending}
                    isError={isError}
                    onRetry={() => void refetch()}
                    onEdit={onEdit}
                    onSortChange={updateViewSort}
                    isSortPending={isPlaceholderData || isSavingSort}
                    activeSortBy={sortBy}
                    activeSortOrder={sortOrder}
                    availableProperties={availableProperties}
                    isPropertiesLoading={isPropertiesLoading}
                    isPropertiesError={isPropertiesError}
                    onRetryProperties={onRetryProperties}
                    navigationState={navigationState}
                    onNavigationStateChange={onNavigationStateChange}
                />
            </div>

            {!isCalendar ? (
                <div className="flex flex-col gap-3 border-t border-border-subtle/75 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <Text as="p" variant="meta" tone="tertiary">
                        {isBoard
                            ? `${view.limit} cards per column load`
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
            {isColumnsOpen ? (
                <ViewTableColumnsDialog
                    view={view}
                    availableProperties={availableProperties}
                    isPropertiesLoading={isPropertiesLoading}
                    isPropertiesError={isPropertiesError}
                    onRetryProperties={onRetryProperties}
                    onClose={() => setIsColumnsOpen(false)}
                    onSave={onSaveColumns}
                />
            ) : null}
        </SurfaceCard>
    );
}
