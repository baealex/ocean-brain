import { useState } from 'react';
import type { NotePropertyKeySummary } from '~/apis/note.api';
import * as Icon from '~/components/icon';
import { Dropdown, Pagination, SurfaceCard } from '~/components/shared';
import { Button, MoreButton, Text } from '~/components/ui';
import type { View, ViewDisplayOptions, ViewSortBy, ViewSortOrder } from '~/models/view.model';
import {
    formatViewPropertyFilter,
    getViewDisplayTypeLabel,
    getViewTagFilterMatchToken,
} from '~/modules/view-dashboard';
import type { ViewNavigationState, ViewRouteStateUpdater } from '~/modules/view-route-state';
import useViewNotes from './useViewNotes';
import ViewChip from './ViewChip';
import ViewNoteCreateButton from './ViewNoteCreateButton';
import ViewRenderer from './ViewRenderer';
import ViewSortMenu from './ViewSortMenu';
import ViewTableColumnsDialog from './ViewTableColumnsDialog';

interface ViewCardProps {
    view: View;
    onEdit: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
    onSaveSort?: (sortBy: ViewSortBy, sortOrder: ViewSortOrder) => Promise<void>;
    onSaveColumns?: (options: ViewDisplayOptions) => Promise<boolean>;
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

const ViewCard = ({
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
}: ViewCardProps) => {
    const [isSavingSort, setIsSavingSort] = useState(false);
    const [isColumnsOpen, setIsColumnsOpen] = useState(false);
    const isBoard = view.displayType === 'board';
    const isCalendar = view.displayType === 'calendar';
    const {
        page,
        offset,
        sortBy,
        sortOrder,
        hasCustomSort,
        notes,
        totalCount,
        lastPage,
        isPending,
        isError,
        isPlaceholderData,
        refetch,
        setViewSort,
        updateViewSort,
    } = useViewNotes(view, navigationState, onNavigationStateChange);
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

    const saveSort = async () => {
        if (!onSaveSort) return;
        setIsSavingSort(true);
        try {
            await onSaveSort(sortBy, sortOrder);
        } finally {
            setIsSavingSort(false);
        }
    };

    return (
        <SurfaceCard flush className="flex h-full flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-border-subtle/75 px-4 py-3.5">
                <div className="min-w-0">
                    <div className="flex items-center gap-1">
                        {dragHandle && <div className="-mr-1 shrink-0 self-center">{dragHandle}</div>}
                        <div className="min-w-0">
                            <Text
                                as="h2"
                                variant="subheading"
                                weight="semibold"
                                tracking="tight"
                                className="flex min-w-0 items-center gap-2"
                            >
                                <span className="truncate">{view.title}</span>
                            </Text>
                        </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
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
                <div className="flex shrink-0 items-center gap-1">
                    <ViewNoteCreateButton viewId={view.id} />
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
                            ...(onDuplicate ? [{ name: 'Duplicate view', onClick: onDuplicate }] : []),
                            ...(onDelete
                                ? [{ type: 'separator' as const }, { name: 'Delete view', onClick: onDelete }]
                                : []),
                        ]}
                    />
                </div>
            </div>

            {!isBoard && !isCalendar ? (
                <div
                    role="group"
                    aria-label={`${view.title} sort`}
                    className="flex flex-wrap items-center gap-2 border-b border-border-subtle/75 px-4 py-2"
                >
                    <ViewSortMenu
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        disabled={isSavingSort}
                        onChange={setViewSort}
                    />
                    {view.displayType === 'table' && onSaveColumns ? (
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
                            {onSaveSort ? (
                                <Button
                                    type="button"
                                    variant="subtle"
                                    size="sm"
                                    isLoading={isSavingSort}
                                    onClick={() => void saveSort()}
                                >
                                    Save default sort
                                </Button>
                            ) : null}
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
            {isColumnsOpen && onSaveColumns ? (
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
};

export default ViewCard;
