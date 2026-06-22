import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { fetchViewSectionNotes, updateViewSection } from '~/apis/view.api';
import { Dropdown, SurfaceCard } from '~/components/shared';
import { Button, MoreButton, Text, useToast } from '~/components/ui';
import type { ViewSection, ViewSortBy, ViewSortOrder } from '~/models/view.model';
import { queryKeys } from '~/modules/query-key-factory';
import { VIEW_NOTES_ROUTE } from '~/modules/url';
import {
    buildViewNotesSearch,
    buildViewSectionInput,
    formatViewPropertyFilter,
    getViewDisplayTypeLabel,
    getViewTagMatchToken,
} from '~/modules/view-dashboard';
import ViewChip from './ViewChip';
import ViewSectionRenderer from './ViewSectionRenderer';

interface ViewSectionCardProps {
    section: ViewSection;
    onEdit: () => void;
    onDelete: () => void;
    dragHandle?: React.ReactNode;
}

export default function ViewSectionCard({ section, onEdit, onDelete, dragHandle }: ViewSectionCardProps) {
    const queryClient = useQueryClient();
    const toast = useToast();
    const [isSortPending, setIsSortPending] = useState(false);
    const sectionSearch = buildViewNotesSearch(section);

    const { data, isPending, isError, refetch } = useQuery({
        queryKey: queryKeys.views.sectionNotes(section.id, {
            limit: section.limit,
            offset: 0,
        }),
        async queryFn() {
            const response = await fetchViewSectionNotes(section.id, { limit: section.limit, offset: 0 });

            if (response.type === 'error') {
                throw response;
            }

            return response.viewSectionNotes;
        },
    });

    const notes = data?.notes ?? [];
    const totalCount = data?.totalCount ?? 0;
    const tagMatchToken = getViewTagMatchToken(section.mode);
    const hasFilters = section.tagNames.length > 0 || section.propertyFilters.length > 0;

    const updateSectionSort = async (sortBy: ViewSortBy) => {
        if (isSortPending) {
            return;
        }

        const nextSortOrder: ViewSortOrder =
            section.sortBy === sortBy
                ? section.sortOrder === 'asc'
                    ? 'desc'
                    : 'asc'
                : sortBy === 'title'
                  ? 'asc'
                  : 'desc';

        setIsSortPending(true);

        const response = await updateViewSection(
            section.id,
            buildViewSectionInput(section, {
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
        <SurfaceCard className="flex h-full flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-1">
                        {dragHandle && <div className="-mr-1 shrink-0 self-center">{dragHandle}</div>}
                        <div className="min-w-0">
                            <Text as="h2" variant="subheading" weight="semibold" tracking="tight" className="min-w-0">
                                <Link
                                    to={VIEW_NOTES_ROUTE}
                                    search={sectionSearch}
                                    className="truncate hover:text-fg-default/85"
                                >
                                    {section.title}
                                </Link>
                            </Text>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        <ViewChip className="max-w-full border-border-subtle/80 bg-elevated text-fg-secondary">
                            {getViewDisplayTypeLabel(section.displayType)}
                        </ViewChip>
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
                <div className="shrink-0">
                    <Dropdown
                        button={<MoreButton label="Section actions" />}
                        items={[
                            {
                                name: 'Edit section',
                                onClick: onEdit,
                            },
                            { type: 'separator' },
                            {
                                name: 'Delete section',
                                onClick: onDelete,
                            },
                        ]}
                    />
                </div>
            </div>

            <div className="flex flex-1 flex-col gap-2.5">
                <ViewSectionRenderer
                    section={section}
                    notes={notes}
                    isPending={isPending}
                    isError={isError}
                    onRetry={() => void refetch()}
                    onEdit={onEdit}
                    onSortChange={updateSectionSort}
                    isSortPending={isSortPending}
                />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border-subtle/70 pt-4">
                <Text as="p" variant="meta" tone="tertiary">
                    {isPending ? 'Loading notes...' : `Showing ${notes.length} of ${totalCount} notes`}
                </Text>
                <Button asChild variant="subtle" size="sm">
                    <Link to={VIEW_NOTES_ROUTE} search={sectionSearch}>
                        Open results
                    </Link>
                </Button>
            </div>
        </SurfaceCard>
    );
}
