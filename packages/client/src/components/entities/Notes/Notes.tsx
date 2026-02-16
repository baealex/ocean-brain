import { useSuspenseQuery } from '@tanstack/react-query';
import { fetchNotes, type FetchNotesParams } from '~/apis/note.api';
import type { Note } from '~/models/note.model';

interface NotesProps {
    searchParams: FetchNotesParams;
    render: (data: {
        notes: Note[];
        totalCount: number;
    }) => React.ReactNode;
}

const createQueryKey = (searchQuery: FetchNotesParams) => {
    return [
        'notes',
        ...Object.values(searchQuery)
    ];
};

const Notes = (props: NotesProps) => {
    const { data } = useSuspenseQuery({
        queryKey: createQueryKey(props.searchParams),
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
