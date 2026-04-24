import { getRouteApi } from '@tanstack/react-router';
import { QueryBoundary } from '~/components/app';
import { TagNotes as TagNotesEntity } from '~/components/entities';
import { NoteListCard } from '~/components/note';
import { Empty, FallbackRender, PageLayout, Pagination, Skeleton } from '~/components/shared';

import useNoteMutate from '~/hooks/resource/useNoteMutate';
import { TAG_NOTES_ROUTE } from '~/modules/url';

const Route = getRouteApi(TAG_NOTES_ROUTE);

export default function TagNotes() {
    const navigate = Route.useNavigate();
    const { id } = Route.useParams();
    const { page } = Route.useSearch();

    const limit = 25;

    const { onDelete, onPinned, deleteWarningDialog } = useNoteMutate();

    return (
        <QueryBoundary
            fallback={
                <PageLayout
                    title="Tagged Notes"
                    heading={<Skeleton width={148} height={24} className="rounded-full" />}
                    description={<Skeleton width={196} height={16} className="rounded-full" />}
                    variant="default"
                >
                    <div className="grid-auto-cards grid gap-5">
                        <Skeleton height="112px" />
                        <Skeleton height="112px" />
                        <Skeleton height="112px" />
                    </div>
                </PageLayout>
            }
            errorTitle="Failed to load tagged notes"
            errorDescription="Retry loading notes for this tag"
            resetKeys={[id, page, limit]}
        >
            <TagNotesEntity
                searchParams={{
                    query: id,
                    offset: (page - 1) * limit,
                    limit,
                }}
                render={({ notes, totalCount }) => {
                    const tagName = notes.flatMap((note) => note.tags).find((tag) => tag.id === id)?.name;

                    return (
                        <PageLayout
                            title={tagName ?? 'Tagged Notes'}
                            heading={
                                tagName ? (totalCount > 0 ? `${tagName} (${totalCount})` : tagName) : 'Tagged Notes'
                            }
                            description="Browse every note linked to this tag"
                            variant="default"
                        >
                            <FallbackRender
                                fallback={
                                    <Empty
                                        title="No tagged notes yet"
                                        description="Notes tagged with this label will appear here"
                                    />
                                }
                            >
                                {notes.length > 0 && (
                                    <div className="flex flex-col gap-4">
                                        <div className="grid-auto-cards grid gap-5">
                                            {notes.map((note) => (
                                                <NoteListCard
                                                    key={note.id}
                                                    {...note}
                                                    onPinned={() => onPinned(note.id, note.pinned)}
                                                    onDelete={() => onDelete(note.id)}
                                                />
                                            ))}
                                        </div>
                                        <FallbackRender fallback={null}>
                                            {totalCount && limit < totalCount && (
                                                <Pagination
                                                    page={page}
                                                    last={Math.ceil(totalCount / limit)}
                                                    onChange={(page) => {
                                                        navigate({
                                                            search: (prev) => ({
                                                                ...prev,
                                                                page,
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
                }}
            />
            {deleteWarningDialog}
        </QueryBoundary>
    );
}
