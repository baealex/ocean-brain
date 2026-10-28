import type { NotePropertyKeySummary } from '~/apis/note.api';
import { Button, Text } from '~/components/ui';
import type { Note } from '~/models/note.model';
import type { View, ViewSortBy, ViewSortOrder } from '~/models/view.model';
import type { ViewNavigationState, ViewRouteStateUpdater } from '~/modules/view-route-state';
import ViewBoardRenderer from './ViewBoardRenderer';
import ViewCalendarRenderer from './ViewCalendarRenderer';
import ViewListRenderer from './ViewListRenderer';
import ViewTableRenderer from './ViewTableRenderer';

interface ViewRendererProps {
    readOnly?: boolean;
    compact?: boolean;
    view: View;
    notes: Note[];
    isPending: boolean;
    isError: boolean;
    onRetry: () => void;
    onEdit: () => void;
    onSortChange: (sortBy: ViewSortBy) => void;
    isSortPending: boolean;
    activeSortBy?: ViewSortBy;
    activeSortOrder?: ViewSortOrder;
    availableProperties?: NotePropertyKeySummary[];
    isPropertiesLoading?: boolean;
    isPropertiesError?: boolean;
    onRetryProperties?: () => void;
    navigationState?: ViewNavigationState;
    onNavigationStateChange?: (updater: ViewRouteStateUpdater) => void;
}

const PropertyMetadataError = ({ displayName, onRetry }: { displayName: string; onRetry: () => void }) => (
    <div className="m-4 rounded-[16px] border border-border-subtle bg-hover-subtle/70 p-4">
        <Text as="p" variant="body" weight="semibold">
            Failed to load {displayName} properties
        </Text>
        <Text as="p" variant="meta" tone="tertiary" className="mt-1">
            Retry to check the configured property without changing this view.
        </Text>
        <div className="mt-3">
            <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
                Retry
            </Button>
        </div>
    </div>
);

const ViewRenderer = ({
    readOnly = false,
    compact = false,
    view,
    notes,
    isPending,
    isError,
    onRetry,
    onEdit,
    onSortChange,
    isSortPending,
    activeSortBy = view.sortBy,
    activeSortOrder = view.sortOrder,
    availableProperties = [],
    isPropertiesLoading = false,
    isPropertiesError = false,
    onRetryProperties = () => undefined,
    navigationState = {},
    onNavigationStateChange = () => undefined,
}: ViewRendererProps) => {
    if (view.displayType === 'board') {
        const groupProperty = availableProperties.find(
            (property) =>
                property.key === view.displayOptions.boardGroupByPropertyKey && property.valueType === 'select',
        );

        if (!groupProperty && isPropertiesLoading) {
            return (
                <div className="flex gap-3 overflow-hidden px-4 py-3.5">
                    <div className="h-[248px] w-[18rem] shrink-0 animate-pulse rounded-[18px] bg-subtle/50" />
                    <div className="h-[248px] w-[18rem] shrink-0 animate-pulse rounded-[18px] bg-subtle/50" />
                    <div className="h-[248px] w-[18rem] shrink-0 animate-pulse rounded-[18px] bg-subtle/50" />
                </div>
            );
        }

        if (!groupProperty && isPropertiesError) {
            return <PropertyMetadataError displayName="board" onRetry={onRetryProperties} />;
        }

        if (!groupProperty || groupProperty.options.length === 0) {
            return (
                <div className="m-4 rounded-[16px] border border-dashed border-border-subtle bg-subtle/40 px-4 py-5">
                    <Text as="p" variant="body" weight="semibold">
                        Board grouping is unavailable
                    </Text>
                    <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                        Choose an existing select property with options to restore this board.
                    </Text>
                    <div className="mt-3">
                        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
                            Edit board
                        </Button>
                    </div>
                </div>
            );
        }

        return (
            <ViewBoardRenderer
                readOnly={readOnly}
                view={view}
                groupProperty={groupProperty}
                navigationState={navigationState}
                onNavigationStateChange={onNavigationStateChange}
            />
        );
    }

    if (view.displayType === 'table') {
        return (
            <ViewTableRenderer
                readOnly={readOnly}
                compact={compact}
                view={view}
                notes={notes}
                isPending={isPending}
                isError={isError}
                onRetry={onRetry}
                onSortChange={onSortChange}
                isSortPending={isSortPending}
                activeSortBy={activeSortBy}
                activeSortOrder={activeSortOrder}
                availableProperties={availableProperties}
            />
        );
    }

    if (view.displayType === 'calendar') {
        const calendarDateProperty =
            view.displayOptions.calendarDateField === 'property'
                ? availableProperties.find(
                      (property) =>
                          property.key === view.displayOptions.calendarDatePropertyKey && property.valueType === 'date',
                  )
                : undefined;

        if (view.displayOptions.calendarDateField === 'property' && !calendarDateProperty) {
            if (isPropertiesLoading) {
                return <div className="m-4 h-[320px] animate-pulse rounded-[18px] bg-subtle/50" />;
            }

            if (isPropertiesError) {
                return <PropertyMetadataError displayName="calendar" onRetry={onRetryProperties} />;
            }

            return (
                <div className="m-4 rounded-[16px] border border-dashed border-border-subtle bg-subtle/40 px-4 py-5">
                    <Text as="p" variant="body" weight="semibold">
                        Calendar date property is unavailable
                    </Text>
                    <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                        Choose an existing date property to restore this calendar.
                    </Text>
                    <div className="mt-3">
                        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
                            Edit calendar
                        </Button>
                    </div>
                </div>
            );
        }

        return (
            <ViewCalendarRenderer
                view={view}
                calendarDateProperty={calendarDateProperty}
                navigationState={navigationState}
                onNavigationStateChange={onNavigationStateChange}
            />
        );
    }

    return (
        <ViewListRenderer compact={compact} notes={notes} isPending={isPending} isError={isError} onRetry={onRetry} />
    );
};

export default ViewRenderer;
