import { useSuspenseQuery } from '@tanstack/react-query';
import { fetchTags } from '~/apis/tag.api';
import type { Tag } from '~/models/tag.model';
import type { WorkspaceScope } from '~/models/workspace.model';
import { queryKeys } from '~/modules/query-key-factory';

interface TagsProps {
    searchParams: {
        scope?: WorkspaceScope;
        query?: string;
        offset: number;
        limit: number;
        sortBy?: 'referenceCount' | 'name';
        sortOrder?: 'asc' | 'desc';
    };
    render: (data: { tags: Tag[]; totalCount: number }) => React.ReactNode;
}

const Tags = (props: TagsProps) => {
    const { data } = useSuspenseQuery({
        queryKey: queryKeys.tags.list(props.searchParams),
        async queryFn() {
            const response = await fetchTags({
                scope: props.searchParams.scope,
                query: props.searchParams.query,
                offset: props.searchParams.offset,
                limit: props.searchParams.limit,
                sortBy: props.searchParams.sortBy,
                sortOrder: props.searchParams.sortOrder,
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
