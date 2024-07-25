import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import { Button, Pagination } from '~/components/shared';
import { NoteListCard } from '~/components/note';
import * as Icon from '~/components/icon';

import useNoteMutate from '~/hooks/resource/useNoteMutate';
import useNotes from '~/hooks/resource/useNotes';

export default function Home() {
    const [searchParams] = useSearchParams();

    const limit = 25;
    const page = Number(searchParams.get('page')) || 1;

    const { data, isLoading } = useNotes({
        offset: (page - 1) * limit,
        limit
    });

    const {
        onCreate,
        onDelete,
        onPinned
    } = useNoteMutate();

    return (
        <>
            <Helmet>
                <title>Ocean Brain</title>
            </Helmet>
            <div className="flex justify-end">
                <Button onClick={onCreate}>
                    <Icon.Plus className="w-5 h-5" /> New
                </Button>
            </div>
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
                    limit={limit}
                    currentPage={page}
                    totalEntries={data.totalCount}
                />
            )}
        </>
    );
}
