import { useSuspenseQuery } from '@tanstack/react-query';
import { fetchTags } from '~/apis/tag.api';
import type { Tag } from '~/models/tag.model';

interface TagsProps {
    searchParams: {
        offset: number;
        limit: number;
    };
    render: (data: {
        tags: Tag[];
        totalCount: number;
    }) => React.ReactNode;
}

const Tags = (props: TagsProps) => {
    const { data } = useSuspenseQuery({
        queryKey: ['tags', props.searchParams.offset, props.searchParams.limit],
        async queryFn() {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const response = await fetchTags({
                offset: props.searchParams.offset,
                limit: props.searchParams.limit
            });
            if (response.type === 'error') {
                throw response;
            }
            return response.allTags;
        }
    });

    return props.render(data);
};

export default Tags;
