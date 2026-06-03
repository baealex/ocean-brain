import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';

import { fetchViewSection, fetchViewSectionNotes, updateViewSection } from '~/apis/view.api';
import { QueryBoundary } from '~/components/app';
import { NoteListCard } from '~/components/note';
import { Empty, FallbackRender, PageLayout, Pagination, Skeleton } from '~/components/shared';
import { Text, useToast } from '~/components/ui';
import { ViewSectionTableRenderer } from '~/components/view';
import useNoteMutate from '~/hooks/resource/useNoteMutate';
import type { ViewSortBy, ViewSortOrder } from '~/models/view.model';
import { queryKeys } from '~/modules/query-key-factory';
import { VIEW_NOTES_ROUTE } from '~/modules/url';
import { buildViewSectionInput, formatViewPropertyFilter, getViewTagMatchLabel } from '~/modules/view-dashboard';

const Route = getRouteApi(VIEW_NOTES_ROUTE);

function ViewNotesContent() {
    const navigate = Route.useNavigate();
    const queryClient = useQueryClient();
    const toast = useToast();
    const { page, sectionId } = Route.useSearch();
    const { onDelete, onPinned, deleteWarningDialog } = useNoteMutate();
    const [isSortPending, setIsSortPending] = useState(false);
    const limit = 25;

    const { data: sectionData } = useSuspenseQuery({
        queryKey: queryKeys.views.section(sectionId),
        async queryFn() {
            const response = await fetchViewSection(sectionId);

            if (response.type === 'error') {
                throw response;
            }

            if (!response.viewSection) {
                throw new Error('View section not found.');
            }

            return response.viewSection;
        },
    });

    const { data } = useSuspenseQuery({
        queryKey: queryKeys.views.sectionNotes(sectionId, {
            limit,
            offset: (page - 1) * limit,
        }),
        async queryFn() {
            const response = await fetchViewSectionNotes(sectionId, {
                limit,
                offset: (page - 1) * limit,
            });

            if (response.type === 'error') {
                throw response;
            }

            return response.viewSectionNotes;
        },
    });

    const heading = sectionData.title;
    const tagNames = sectionData.tagNames;
    const mode = sectionData.mode;
    const propertyFilters = sectionData.propertyFilters;
    const hasTagFilter = tagNames.length > 0;
    const hasPropertyFilter = propertyFilters.length > 0;
    const filterSummary = hasTagFilter
        ? hasPropertyFilter
            ? `Property and tag filters · ${getViewTagMatchLabel(mode)}`
            : `Tag filters · ${getViewTagMatchLabel(mode)}`
        : hasPropertyFilter
          ? 'Property filters'
          : 'All notes';
    const pagination = (
        <FallbackRender fallback={null}>
            {data.totalCount && limit < data.totalCount && (
                <Pagination
                    page={page}
                    last={Math.ceil(data.totalCount / limit)}
                    onChange={(nextPage) => {
                        navigate({
                            search: (prev) => ({
                                ...prev,
                                page: nextPage,
                            }),
                        });
                    }}
                />
            )}
        </FallbackRender>
    );

    const updateSectionSort = async (sortBy: ViewSortBy) => {
        if (isSortPending) {
            return;
        }

        const nextSortOrder: ViewSortOrder =
            sectionData.sortBy === sortBy
                ? sectionData.sortOrder === 'asc'
                    ? 'desc'
                    : 'asc'
                : sortBy === 'title'
                  ? 'asc'
                  : 'desc';

        setIsSortPending(true);

        const response = await updateViewSection(
            sectionData.id,
            buildViewSectionInput(sectionData, {
                sortBy,
                sortOrder: nextSortOrder,
            }),
        );

        if (response.type === 'error') {
            toast(response.errors[0]?.message ?? 'Failed to update table sort.');
            setIsSortPending(false);
            return;
        }

        await queryClient.invalidateQueries({
            queryKey: queryKeys.views.all(),
            exact: false,
        });
        setIsSortPending(false);
    };

    return (
        <PageLayout
            title={heading}
            heading={data.totalCount > 0 ? `${heading} (${data.totalCount})` : heading}
            description={
                <div className="flex flex-col gap-2">
                    <Text as="span" variant="meta" tone="tertiary">
                        {filterSummary}
                    </Text>
                    <div className="flex flex-wrap gap-1.5">
                        {tagNames.map((tagName) => (
                            <span
                                key={tagName}
                                className="inline-flex items-center rounded-full border border-border-subtle bg-hover-subtle px-2.5 py-1 text-xs font-medium text-fg-secondary"
                            >
                                {tagName}
                            </span>
                        ))}
                        {propertyFilters.map((filter) => (
                            <span
                                key={`${filter.key}-${filter.operator}-${filter.value ?? ''}`}
                                className="inline-flex items-center rounded-full border border-border-subtle bg-hover-subtle px-2.5 py-1 text-xs font-medium text-fg-secondary"
                            >
                                {formatViewPropertyFilter(filter)}
                            </span>
                        ))}
                        {tagNames.length === 0 && propertyFilters.length === 0 && (
                            <span className="inline-flex items-center rounded-full border border-border-subtle bg-hover-subtle px-2.5 py-1 text-xs font-medium text-fg-secondary">
                                All notes
                            </span>
                        )}
                    </div>
                </div>
            }
        >
            <FallbackRender
                fallback={
                    <Empty
                        title="No notes match this saved view"
                        description="Adjust this view's filters or keep writing until matching notes appear."
                    />
                }
            >
                {data.notes.length > 0 && sectionData.displayType === 'table' ? (
                    <div className="flex flex-col gap-4">
                        <ViewSectionTableRenderer
                            section={sectionData}
                            notes={data.notes}
                            isPending={false}
                            isError={false}
                            onRetry={() =>
                                void queryClient.invalidateQueries({
                                    queryKey: queryKeys.views.sectionNotes(sectionId, {
                                        limit,
                                        offset: (page - 1) * limit,
                                    }),
                                })
                            }
                            onSortChange={updateSectionSort}
                            isSortPending={isSortPending}
                        />
                        {pagination}
                    </div>
                ) : data.notes.length > 0 ? (
                    <div className="flex flex-col gap-4">
                        <div className="grid-auto-cards grid gap-5">
                            {data.notes.map((note) => (
                                <NoteListCard
                                    key={note.id}
                                    {...note}
                                    onPinned={() => onPinned(note.id, note.pinned)}
                                    onDelete={() => onDelete(note.id)}
                                />
                            ))}
                        </div>
                        {pagination}
                    </div>
                ) : null}
            </FallbackRender>
            {deleteWarningDialog}
        </PageLayout>
    );
}

export default function ViewNotes() {
    const { sectionId, page } = Route.useSearch();

    if (!sectionId) {
        return (
            <PageLayout title="View Notes" description="Saved view note lists require a section id.">
                <Empty title="No section selected" description="Return to Views and open a section from there." />
            </PageLayout>
        );
    }

    return (
        <QueryBoundary
            fallback={
                <PageLayout
                    title="View Notes"
                    heading={<Skeleton width={180} height={24} className="rounded-full" />}
                    description={<Skeleton width={220} height={16} className="rounded-full" />}
                >
                    <div className="grid-auto-cards grid gap-5">
                        <Skeleton height="112px" />
                        <Skeleton height="112px" />
                        <Skeleton height="112px" />
                    </div>
                </PageLayout>
            }
            errorTitle="Failed to load view notes"
            errorDescription="Retry loading notes for this saved view section"
            resetKeys={[page, sectionId]}
        >
            <ViewNotesContent />
        </QueryBoundary>
    );
}
