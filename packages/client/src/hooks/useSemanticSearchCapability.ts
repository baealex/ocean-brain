import { useQuery } from '@tanstack/react-query';

import { fetchSearchAdminStatus } from '~/apis/search-admin.api';
import { queryKeys } from '~/modules/query-key-factory';

const useSemanticSearchCapability = () => {
    const query = useQuery({
        queryKey: queryKeys.search.adminStatus(),
        queryFn: fetchSearchAdminStatus,
        staleTime: 60_000,
        retry: 1,
    });

    return {
        status: query.data,
        isLoading: query.isPending,
        isSemanticSearchEnabled: query.data?.config.enabled === true,
        isSemanticSearchAvailable: query.data?.available === true,
    };
};

export default useSemanticSearchCapability;
