import { useSuspenseQuery } from '@tanstack/react-query';
import { fetchNotes, type FetchNotesParams } from '~/apis/note.api';
import type { Note } from '~/models/note.model';
import { queryKeys } from '~/modules/query-key-factory';

interface NotesProps {
    searchParams: FetchNotesParams;
    render: (data: {
        notes: Note[];
        totalCount: number;
    }) => React.ReactNode;
}

const Notes = (props: NotesProps) => {
    const { data } = useSuspenseQuery({
        queryKey: queryKeys.notes.list(props.searchParams),
        async queryFn() {
            const response = await fetchNotes(props.searchParams);
            if (response.type === 'error') {
                throw response;
            }
            return response.allNotes;
        }
    });

    return props.render(data);
};

export default Notes;
