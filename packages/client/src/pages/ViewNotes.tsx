import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';

import { fetchViewSection, fetchViewSectionNotes } from '~/apis/view.api';
import { QueryBoundary } from '~/components/app';
import { NoteListCard } from '~/components/note';
import { Empty, FallbackRender, PageLayout, Pagination, Skeleton } from '~/components/shared';
import { Text } from '~/components/ui';
import useNoteMutate from '~/hooks/resource/useNoteMutate';
import { queryKeys } from '~/modules/query-key-factory';
import { VIEW_NOTES_ROUTE } from '~/modules/url';
import { getViewTagMatchLabel } from '~/modules/view-dashboard';

const Route = getRouteApi(VIEW_NOTES_ROUTE);

function ViewNotesContent() {
    const navigate = Route.useNavigate();
    const { page, sectionId } = Route.useSearch();
    const { onDelete, onPinned } = useNoteMutate();
    const limit = 25;

    const { data: sectionData } = useQuery({
        queryKey: queryKeys.views.section(sectionId),
        async queryFn() {
            const response = await fetchViewSection(sectionId);

            if (response.type === 'error') {
                throw response;
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

    const heading = sectionData?.title || 'View Notes';
    const tagNames = sectionData?.tagNames ?? [];
    const mode = sectionData?.mode ?? 'and';

    return (
        <PageLayout
            title={heading}
            heading={data.totalCount > 0 ? `${heading} (${data.totalCount})` : heading}
            description={
                <div className="flex flex-col gap-2">
                    <Text as="span" variant="meta" tone="tertiary">
                        {getViewTagMatchLabel(mode)}
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
                    </div>
                </div>
            }
        >
            <FallbackRender
                fallback={
                    <Empty
                        title="No notes match this saved view"
                        description="Adjust the section tags or keep writing until matching notes appear."
                    />
                }
            >
                {data.notes.length > 0 && (
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
                    </div>
                )}
            </FallbackRender>
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
