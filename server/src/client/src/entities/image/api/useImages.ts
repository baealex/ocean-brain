import { useSuspenseQuery } from '@tanstack/react-query';
import { fetchImages } from './image.api';

interface UseImagesParams {
    offset?: number;
    limit?: number;
}

export const useImages = ({ offset = 0, limit = 50 }: UseImagesParams = {}) => {
    return useSuspenseQuery({
        queryKey: ['images', offset, limit],
        async queryFn() {
            const response = await fetchImages({ offset, limit });
            if (response.type === 'error') {
                throw response;
            }
            return response.allImages;
        }
    });
};
