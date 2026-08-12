import type { NotePropertyKeySummary } from '~/apis/note.api';
import { Button, Text } from '~/components/ui';
import type { Note } from '~/models/note.model';
import type { ViewSection, ViewSortBy, ViewSortOrder } from '~/models/view.model';
import type { ViewSectionRouteState, ViewSectionRouteStateUpdater } from '~/modules/view-route-state';
import ViewSectionBoardRenderer from './ViewSectionBoardRenderer';
import ViewSectionCalendarRenderer from './ViewSectionCalendarRenderer';
import ViewSectionListRenderer from './ViewSectionListRenderer';
import ViewSectionTableRenderer from './ViewSectionTableRenderer';

interface ViewSectionRendererProps {
    section: ViewSection;
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
    navigationState?: ViewSectionRouteState;
    onNavigationStateChange?: (updater: ViewSectionRouteStateUpdater) => void;
}

export default function ViewSectionRenderer({
    section,
    notes,
    isPending,
    isError,
    onRetry,
    onEdit,
    onSortChange,
    isSortPending,
    activeSortBy = section.sortBy,
    activeSortOrder = section.sortOrder,
    availableProperties = [],
    isPropertiesLoading = false,
    navigationState = {},
    onNavigationStateChange = () => undefined,
}: ViewSectionRendererProps) {
    if (section.displayType === 'board') {
        const groupProperty = availableProperties.find(
            (property) =>
                property.key === section.displayOptions.boardGroupByPropertyKey && property.valueType === 'select',
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
            <ViewSectionBoardRenderer
                section={section}
                groupProperty={groupProperty}
                navigationState={navigationState}
                onNavigationStateChange={onNavigationStateChange}
            />
        );
    }

    if (section.displayType === 'table') {
        return (
            <ViewSectionTableRenderer
                section={section}
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

    if (section.displayType === 'calendar') {
        return (
            <ViewSectionCalendarRenderer
                section={section}
                navigationState={navigationState}
                onNavigationStateChange={onNavigationStateChange}
            />
        );
    }

    return <ViewSectionListRenderer notes={notes} isPending={isPending} isError={isError} onRetry={onRetry} />;
}
