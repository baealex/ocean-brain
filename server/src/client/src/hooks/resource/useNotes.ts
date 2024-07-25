import { useQuery } from 'react-query';

import type { FetchNotesParams } from '~/apis/note.api';
import { fetchNotes } from '~/apis/note.api';

interface UseNotesProps extends FetchNotesParams {

}

const createQueryKey = (searchQuery: UseNotesProps) => {
    return [
        'notes',
        ...Object.values(searchQuery)
    ];
};

const useNotes = (searchQuery: UseNotesProps) => {
    const { data, isLoading } = useQuery(createQueryKey(searchQuery), () => {
        return fetchNotes(searchQuery);
    });

    return {
        data,
        isLoading
    };
};

export default useNotes;
