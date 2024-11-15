import { useQuery } from 'react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import { Pagination } from '~/components/shared';
import { NoteListCard } from '~/components/note';

import useNoteMutate from '~/hooks/resource/useNoteMutate';

import { fetchTagNotes } from '~/apis/note.api';

export default function TagNotes() {
    const { id } = useParams();

    const [searchParams, setSearchParams] = useSearchParams();

    const limit = 25;
    const page = Number(searchParams.get('page')) || 1;

    const { data, isLoading } = useQuery(['notes', 'tags', id, page], () => {
        return fetchTagNotes({
            query: id,
            offset: (page - 1) * limit,
            limit
        });
    }, { enabled: !!id });

    const {
        onDelete,
        onPinned
    } = useNoteMutate();

    return (
        <>
            <Helmet>
                <title>Tag | Ocean Brain</title>
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
        </>
    );
}
