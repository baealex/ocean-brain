import { useQuery } from 'react-query';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import { Button, Pagination } from '~/components/shared';
import { NoteListCard } from '~/components/note';
import * as Icon from '~/components/icon';

import {
    fetchNotes,
    fetchTotalNotes
} from '~/apis/note.api';
import useNoteMutate from '~/hooks/useNoteMutate';

export default function Home() {
    const [searchParams] = useSearchParams();

    const limit = 25;
    const page = Number(searchParams.get('page')) || 1;

    const { data: totalNotes } = useQuery('totalNotes', () => {
        return fetchTotalNotes();
    });

    const { data: notes, isLoading } = useQuery(['notes', page], () => {
        return fetchNotes({
            offset: (page - 1) * limit,
            limit,
            extend: `
                tags {
                    id
                    name
                }
            `
        });
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
                    <Icon.Plus/> New
                </Button>
            </div>
            <div className="grid gap-6 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {!isLoading && notes && notes.map(note => (
                    <NoteListCard
                        key={note.id}
                        {...note}
                        onPinned={() => onPinned(note.id, note.pinned)}
                        onDelete={() => onDelete(note.id)}
                    />
                ))}
            </div>
            {totalNotes && limit < totalNotes && (
                <Pagination
                    limit={limit}
                    currentPage={page}
                    totalEntries={totalNotes}
                />
            )}
        </>
    );
}
