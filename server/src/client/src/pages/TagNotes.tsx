import { useQuery } from 'react-query';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import { Button } from '~/components/shared';
import { NoteListCard } from '~/components/note';
import * as Icon from '~/components/icon';

import useNoteMutate from '~/hooks/useNoteMutate';

import type { Note } from '~/models/Note';

import { fetchTagNotes } from '~/apis/note.api';

export default function TagNotes() {
    const { id } = useParams();

    const { data: notes, isLoading } = useQuery<Note[]>(['notes', 'tags', id], () => {
        return fetchTagNotes(id!);
    }, { enabled: !!id });

    const {
        onCreate,
        onDelete,
        onPinned
    } = useNoteMutate();

    return (
        <>
            <Helmet>
                <title>Tag | Ocean Brain</title>
            </Helmet>
            <div className="flex justify-end">
                <Button onClick={onCreate}>
                    <Icon.Plus className="w-5 h-5" /> New
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
        </>
    );
}
