import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchViewNotes } from '~/apis/view.api';
import type { View, ViewSortBy, ViewSortOrder } from '~/models/view.model';
import { queryKeys } from '~/modules/query-key-factory';
import type { ViewNavigationState, ViewRouteStateUpdater } from '~/modules/view-route-state';

const useViewNotes = (view: View, state: ViewNavigationState, update: (updater: ViewRouteStateUpdater) => void) => {
    const isPaginated = view.displayType === 'list' || view.displayType === 'table';
    const page = state.page ?? 1;
    const offset = (page - 1) * view.limit;
    const sortBy = state.sort?.by ?? view.sortBy;
    const sortOrder = state.sort?.order ?? view.sortOrder;
    const query = useQuery({
        queryKey: queryKeys.views.viewNotes(view.id, { limit: view.limit, offset, sortBy, sortOrder }),
        enabled: isPaginated,
        placeholderData: keepPreviousData,
        async queryFn() {
            const response = await fetchViewNotes(view.id, { limit: view.limit, offset, sortBy, sortOrder });
            if (response.type === 'error') throw response;
            return response.viewNotes;
        },
    });
    const notes = query.data?.notes ?? [];
    const totalCount = query.data?.totalCount ?? 0;
    const lastPage = Math.max(1, Math.ceil(totalCount / view.limit));
    const setPage = (nextPage: number) => update((current) => ({ ...current, page: nextPage }));
    const setViewSort = (by: ViewSortBy, order: ViewSortOrder) =>
        update((current) => ({
            ...current,
            page: 1,
            sort: by === view.sortBy && order === view.sortOrder ? undefined : { by, order },
        }));
    const updateViewSort = (by: ViewSortBy) => {
        const order = sortBy === by ? (sortOrder === 'asc' ? 'desc' : 'asc') : by === 'title' ? 'asc' : 'desc';
        setViewSort(by, order);
    };

    useEffect(() => {
        if (
            !isPaginated ||
            query.isPending ||
            query.isError ||
            query.isPlaceholderData ||
            !query.data ||
            page <= lastPage
        )
            return;
        update((current) => ({ ...current, page: lastPage }));
    }, [isPaginated, query.isPending, query.isError, query.isPlaceholderData, query.data, page, lastPage, update]);

    return {
        ...query,
        notes,
        totalCount,
        lastPage,
        page,
        offset,
        sortBy,
        sortOrder,
        isPaginated,
        hasCustomSort: sortBy !== view.sortBy || sortOrder !== view.sortOrder,
        setPage,
        setViewSort,
        updateViewSort,
    };
};

export default useViewNotes;
