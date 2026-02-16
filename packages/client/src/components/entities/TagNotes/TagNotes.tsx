import { useSuspenseQuery } from '@tanstack/react-query';
import { fetchTagNotes, type FetchTagNotesParams } from '~/apis/note.api';
import type { Note } from '~/models/note.model';

interface TagNotesProps {
    searchParams: FetchTagNotesParams;
    render: (data: {
        notes: Note[];
        totalCount: number;
    }) => React.ReactNode;
}

const createQueryKey = (searchQuery: FetchTagNotesParams) => {
    return [
        'tag-notes',
        ...Object.values(searchQuery)
    ];
};

const TagNotes = (props: TagNotesProps) => {
    const { data } = useSuspenseQuery({
        queryKey: createQueryKey(props.searchParams),
        async queryFn() {
            const response = await fetchTagNotes({
                query: props.searchParams.query,
                offset: props.searchParams.offset,
                limit: props.searchParams.limit
            });
            if (response.type === 'error') {
                throw response;
            }
            return response.tagNotes;
        }
    });

    return props.render(data);
};

export default TagNotes;
