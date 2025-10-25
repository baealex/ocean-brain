import { useSuspenseQuery } from '@tantml:invoke>@tanstack/react-query';
import { fetchNotes, type FetchNotesParams } from './note.api';

const createQueryKey = (searchParams: FetchNotesParams) => {
    return [
        'notes',
        ...Object.values(searchParams)
    ];
};

export const useNotes = (searchParams: FetchNotesParams = {}) => {
    return useSuspenseQuery({
        queryKey: createQueryKey(searchParams),
        async queryFn() {
            const response = await fetchNotes(searchParams);
            if (response.type === 'error') {
                throw response;
            }
            return response.allNotes;
        }
    });
};
