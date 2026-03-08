import { Suspense } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import {
    Empty,
    FallbackRender,
    PageLayout,
    Pagination,
    Skeleton
} from '~/components/shared';
import { NoteListCard } from '~/components/note';
import { TagNotes as TagNotesEntity } from '~/components/entities';

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
        <PageLayout title="Tag" variant="subtle">
            <Suspense
                fallback={(
                    <div className="grid gap-6 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                        <Skeleton height="112px" />
                        <Skeleton height="112px" />
                        <Skeleton height="112px" />
                    </div>
                )}>
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
                                    icon="🧠"
                                    title="Ocean is calm"
                                    description="Capture anything and make waves in the ocean!"
                                />
                            )}>
                            {notes.length > 0 && (
                                <>
                                    <div className="grid gap-6 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
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
                                </>
                            )}
                        </FallbackRender>
                    )}
                />
            </Suspense>
        </PageLayout>
    );
}
