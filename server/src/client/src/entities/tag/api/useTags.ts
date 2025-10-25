import { useSuspenseQuery } from '@tanstack/react-query';
import { fetchTags } from './tag.api';

interface UseTagsParams {
    offset?: number;
    limit?: number;
}

export const useTags = (searchParams: UseTagsParams = {}) => {
    const { offset = 0, limit = 25 } = searchParams;

    return useSuspenseQuery({
        queryKey: ['tags', offset, limit],
        async queryFn() {
            const response = await fetchTags({ offset, limit });
            if (response.type === 'error') {
                throw response;
            }
            return response.allTags;
        }
    });
};
