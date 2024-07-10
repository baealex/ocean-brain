import { useQuery } from 'react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import { Button } from '~/components/shared';
import { NoteListCard } from '~/components/note';
import * as Icon from '~/components/icon';

import type { Note } from '~/models/Note';

import { createNote, fetchTagNotes } from '~/apis/note.api';

export default function TagNotes() {
    const { id } = useParams();

    const navigate = useNavigate();

    const { data: notes, isLoading } = useQuery<Note[]>(['notes', 'tags', id], () => {
        return fetchTagNotes(id!);
    }, { enabled: !!id });

    const handleClickCreate = async () => {
        const { id } = await createNote();
        navigate(`/${id}`);
    };

    return (
        <>
            <Helmet>
                <title>Tag | Ocean Brain</title>
            </Helmet>
            <div className="flex justify-end">
                <Button onClick={handleClickCreate}>
                    <Icon.Plus/> New
                </Button>
            </div>
            <div className="grid gap-6 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {!isLoading && notes && notes.map(note => (
                    <NoteListCard
                        key={note.id}
                        {...note}
                    />
                ))}
            </div>
        </>
    );
}
