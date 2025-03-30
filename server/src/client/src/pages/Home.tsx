import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import { FallbackRender, Pagination } from '~/components/shared';
import { NoteListCard } from '~/components/note';

import useNoteMutate from '~/hooks/resource/useNoteMutate';
import useNotes from '~/hooks/resource/useNotes';

export default function Home() {
    const [searchParams, setSearchParams] = useSearchParams();

    const limit = 25;
    const page = Number(searchParams.get('page')) || 1;

    const { data, isLoading } = useNotes({
        offset: (page - 1) * limit,
        limit
    });

    const {
        onDelete,
        onPinned
    } = useNoteMutate();

    return (
        <>
            <Helmet>
                <title>Ocean Brain</title>
            </Helmet>
            <div className="grid gap-6 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {!isLoading && data?.notes && data.notes.map(note => (
                    <NoteListCard
                        key={note.id}
                        {...note}
                        onPinned={() => onPinned(note.id, note.pinned)}
                        onDelete={() => onDelete(note.id)}
                    />
                ))}
            </div>
            <FallbackRender fallback={null}>
                {data?.totalCount && limit < data.totalCount && (
                    <Pagination
                        page={page}
                        last={Math.ceil(data.totalCount / limit)}
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
    );
}
