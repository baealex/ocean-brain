import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { fetchAllNotePropertyKeys } from '~/apis/note.api';
import * as Icon from '~/components/icon';
import NoteContentSection from '~/components/shared/NoteContentSection';
import { Button, Text } from '~/components/ui';
import type { View } from '~/models/view.model';
import { queryKeys } from '~/modules/query-key-factory';
import {
    formatViewPropertyFilter,
    getViewDisplayTypeLabel,
    getViewTagFilterMatchToken,
} from '~/modules/view-dashboard';
import type { ViewNavigationState } from '~/modules/view-route-state';
import useViewNotes from './useViewNotes';
import ViewNoteCreateButton from './ViewNoteCreateButton';
import ViewRenderer from './ViewRenderer';
import ViewSortMenu from './ViewSortMenu';

const LinkedViewContent = ({
    view,
    onEdit,
    actions,
    readOnly,
}: {
    view: View;
    onEdit: () => void;
    actions: ReactNode;
    readOnly: boolean;
}) => {
    const [navigation, setNavigation] = useState<ViewNavigationState>({});
    const results = useViewNotes(view, navigation, setNavigation);
    const properties = useQuery({
        queryKey: queryKeys.notes.propertyKeysCatalog(),
        async queryFn() {
            const response = await fetchAllNotePropertyKeys();
            if (response.type === 'error') throw response;
            return response.notePropertyKeys;
        },
    });
    const filters = [
        view.tagNames.join(` ${getViewTagFilterMatchToken(view.mode)} `),
        ...view.propertyFilters.map(formatViewPropertyFilter),
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <NoteContentSection label={view.title}>
            <div className="mb-2 flex min-h-8 items-center justify-between gap-2">
                <Text
                    as="h3"
                    variant="body"
                    weight="semibold"
                    className="min-w-0 truncate"
                    title={`${getViewDisplayTypeLabel(view.displayType)}${filters ? ` · ${filters}` : ''}`}
                >
                    {view.title}
                </Text>
                <div className="flex shrink-0 items-center gap-1">
                    {!readOnly ? <ViewNoteCreateButton viewId={view.id} /> : null}
                    {results.isPaginated ? (
                        <ViewSortMenu
                            compact
                            sortBy={results.sortBy}
                            sortOrder={results.sortOrder}
                            disabled={results.isPending || results.isPlaceholderData}
                            summary={filters}
                            onChange={results.setViewSort}
                        />
                    ) : null}
                    {actions}
                </div>
            </div>
            <ViewRenderer
                compact
                readOnly={readOnly}
                view={view}
                notes={results.notes}
                isPending={results.isPending}
                isError={results.isError}
                onRetry={() => void results.refetch()}
                onEdit={onEdit}
                onSortChange={results.updateViewSort}
                isSortPending={results.isPlaceholderData}
                activeSortBy={results.sortBy}
                activeSortOrder={results.sortOrder}
                availableProperties={properties.data?.keys ?? []}
                isPropertiesLoading={properties.isPending}
                isPropertiesError={properties.isError}
                onRetryProperties={() => void properties.refetch()}
                navigationState={navigation}
                onNavigationStateChange={setNavigation}
            />
            {results.isPaginated && !results.isPending && !results.isError && results.totalCount > 0 ? (
                <div
                    className="mt-2 flex min-h-7 items-center justify-between gap-2 text-xs text-fg-tertiary"
                    aria-live="polite"
                >
                    <span>
                        {results.offset + 1}–{Math.min(results.offset + results.notes.length, results.totalCount)} of{' '}
                        {results.totalCount}
                    </span>
                    {results.lastPage > 1 ? (
                        <nav aria-label={`${view.title} pages`} className="flex items-center gap-1">
                            <Button
                                type="button"
                                variant="subtle"
                                size="icon-sm"
                                aria-label="Previous page"
                                disabled={results.page <= 1 || results.isPlaceholderData}
                                onClick={() => results.setPage(results.page - 1)}
                            >
                                <Icon.ChevronLeft className="size-3.5" />
                            </Button>
                            <Button
                                type="button"
                                variant="subtle"
                                size="icon-sm"
                                aria-label="Next page"
                                disabled={results.page >= results.lastPage || results.isPlaceholderData}
                                onClick={() => results.setPage(results.page + 1)}
                            >
                                <Icon.ChevronRight className="size-3.5" />
                            </Button>
                        </nav>
                    ) : null}
                </div>
            ) : null}
        </NoteContentSection>
    );
};

export default LinkedViewContent;
