import { useSuspenseQuery } from '@tanstack/react-query';
import { fetchTags } from '~/apis/tag.api';
import type { Tag } from '~/models/tag.model';
import { queryKeys } from '~/modules/query-key-factory';

interface TagsProps {
    searchParams: {
        offset: number;
        limit: number;
    };
    render: (data: { tags: Tag[]; totalCount: number }) => React.ReactNode;
}

const Tags = (props: TagsProps) => {
    const { data } = useSuspenseQuery({
        queryKey: queryKeys.tags.list(props.searchParams),
        async queryFn() {
            const response = await fetchTags({
                offset: props.searchParams.offset,
                limit: props.searchParams.limit,
            });
            if (response.type === 'error') {
                throw response;
            }
            return response.allTags;
        },
    });

    return props.render(data);
};

export default Tags;
