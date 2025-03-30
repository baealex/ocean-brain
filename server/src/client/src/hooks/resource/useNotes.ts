import { useQuery } from '@tanstack/react-query';

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
    const { data, isError, isLoading } = useQuery({
        queryKey: createQueryKey(searchQuery),
        async queryFn() {
            const response = await fetchNotes(searchQuery);
            if (response.type === 'error') {
                throw response;
            }
            return response.allNotes;
        }
    });

    return {
        data,
        isError,
        isLoading
    };
};

export default useNotes;
