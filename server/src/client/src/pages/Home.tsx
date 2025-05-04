import { Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import { Empty, FallbackRender, Pagination, Skeleton } from '~/components/shared';
import { NoteListCard } from '~/components/note';
import { Notes } from '~/components/entities';

import useNoteMutate from '~/hooks/resource/useNoteMutate';

export default function Home() {
    const [searchParams, setSearchParams] = useSearchParams();

    const limit = 25;
    const page = Number(searchParams.get('page')) || 1;

    const {
        onDelete,
        onPinned
    } = useNoteMutate();

    return (
        <>
            <Helmet>
                <title>Ocean Brain</title>
            </Helmet>
            <Suspense
                fallback={(
                    <>
                        <div className="grid gap-6 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                            <Skeleton height="112px" />
                            <Skeleton height="112px" />
                            <Skeleton height="112px" />
                        </div>
                    </>
                )}>
                <Notes
                    searchParams={{
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
                                    <FallbackRender fallback={null}>
                                        {totalCount && limit < totalCount && (
                                            <Pagination
                                                page={page}
                                                last={Math.ceil(totalCount / limit)}
                                                onChange={(page) => {
                                                    setSearchParams(searchParams => {
                                                        searchParams.set('page', page.toString());
                                                        return searchParams;
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
        </>
    );
}
