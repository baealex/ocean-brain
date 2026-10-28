import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { type BackReferenceDetail, type BackReferencePage, fetchBackReferenceDetails } from '~/apis/note.api';
import { queryKeys } from '~/modules/query-key-factory';

interface BackReferencesProps {
    noteId: string;
    render: (
        notes: BackReferenceDetail[],
        pagination: {
            hasMore: boolean;
            isPending: boolean;
            isError: boolean;
            loadMore: () => void;
        },
    ) => React.ReactNode;
}

const BackReferences = (props: BackReferencesProps) => {
    const query = useSuspenseInfiniteQuery({
        queryKey: queryKeys.notes.backReferenceDetails(props.noteId),
        initialPageParam: 0,
        getNextPageParam: (page: BackReferencePage) => page.nextOffset ?? undefined,
        async queryFn({ pageParam }) {
            const response = await fetchBackReferenceDetails({ id: props.noteId, limit: 20, offset: pageParam });
            if (response.type === 'error') {
                throw response;
            }
            return response.backReferenceDetails;
        },
    });

    return props.render(
        query.data.pages.flatMap((page) => page.references),
        {
            hasMore: query.hasNextPage,
            isPending: query.isFetchingNextPage,
            isError: query.isFetchNextPageError,
            loadMore: () => {
                void query.fetchNextPage();
            },
        },
    );
};

export default BackReferences;
