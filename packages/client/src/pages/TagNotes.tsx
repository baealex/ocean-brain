import { getRouteApi } from '@tanstack/react-router';
import { QueryBoundary } from '~/components/app';
import {
    Empty,
    FallbackRender,
    PageLayout,
    Pagination,
    Skeleton
} from '~/components/shared';
import { NoteListCard } from '~/components/note';
import { TagNotes as TagNotesEntity } from '~/components/entities';
import { Text } from '~/components/ui';

import useNoteMutate from '~/hooks/resource/useNoteMutate';
import { TAG_NOTES_ROUTE } from '~/modules/url';

const Route = getRouteApi(TAG_NOTES_ROUTE);

export default function TagNotes() {
    const navigate = Route.useNavigate();
    const { id } = Route.useParams();
    const { page } = Route.useSearch();

    const limit = 25;

    const {
        onDelete,
        onPinned
    } = useNoteMutate();

    return (
        <PageLayout
            title="Tagged Notes"
            description="Browse notes grouped under a single tag"
            variant="default">
            <QueryBoundary
                fallback={(
                    <div className="grid-auto-cards grid gap-5">
                        <Skeleton height="112px" />
                        <Skeleton height="112px" />
                        <Skeleton height="112px" />
                    </div>
                )}
                errorTitle="Failed to load tagged notes"
                errorDescription="Retry loading notes for this tag."
                resetKeys={[id, page, limit]}>
                <TagNotesEntity
                    searchParams={{
                        query: id,
                        offset: (page - 1) * limit,
                        limit
                    }}
                    render={({ notes, totalCount }) => (
                        <FallbackRender
                            fallback={(
                                <Empty
                                    title="No tagged notes yet"
                                    description="Notes linked to this tag will appear here."
                                />
                            )}>
                            {notes.length > 0 && (
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-1">
                                        <Text as="p" variant="meta" tone="secondary">
                                            {totalCount === 1 ? '1 note in this tag' : `${totalCount} notes in this tag`}
                                        </Text>
                                        <Text as="p" variant="subheading" weight="semibold" tone="secondary">
                                            {
                                                notes
                                                    .flatMap((note) => note.tags)
                                                    .find((tag) => tag.id === id)?.name ?? 'Tagged collection'
                                            }
                                        </Text>
                                    </div>
                                    <div className="grid-auto-cards grid gap-5">
                                        {notes.map(note => (
                                            <NoteListCard
                                                key={note.id}
                                                {...note}
                                                onPinned={() => onPinned(note.id, note.pinned)}
                                                onDelete={() => onDelete(note.id)}
                                            />
                                        ))}
                                    </div>
                                    <FallbackRender
                                        fallback={null}>
                                        {totalCount && limit < totalCount && (
                                            <Pagination
                                                page={page}
                                                last={Math.ceil(totalCount / limit)}
                                                onChange={(page) => {
                                                    navigate({
                                                        search: prev => ({
                                                            ...prev,
                                                            page
                                                        })
                                                    });
                                                }}
                                            />
                                        )}
                                    </FallbackRender>
                                </div>
                            )}
                        </FallbackRender>
                    )}
                />
            </QueryBoundary>
        </PageLayout>
    );
}
