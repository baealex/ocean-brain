import { useSuspenseQuery } from '@tanstack/react-query';
import { fetchImages } from '~/apis/image.api';
import type { Image } from '~/models/image.model';

interface ImagesProps {
    searchParams: {
        offset: number;
        limit: number;
    };
    render: (data: {
        images: Image[];
        totalCount: number;
    }) => React.ReactNode;
}

const Images = (props: ImagesProps) => {
    const { data } = useSuspenseQuery({
        queryKey: ['images', props.searchParams.offset, props.searchParams.limit],
        async queryFn() {
            const response = await fetchImages({
                offset: props.searchParams.offset,
                limit: props.searchParams.limit
            });
            if (response.type === 'error') {
                throw response;
            }
            return response.allImages;
        }
    });

    return props.render(data);
};

export default Images;
