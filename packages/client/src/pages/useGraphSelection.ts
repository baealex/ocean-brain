import { getRouteApi } from '@tanstack/react-router';
import { useCallback } from 'react';

import { GRAPH_ROUTE, NOTE_ROUTE } from '~/modules/url';

const Route = getRouteApi(GRAPH_ROUTE);

export function useGraphSelection() {
    const navigate = Route.useNavigate();
    const { selected } = Route.useSearch();
    const selectedNodeId = selected ?? null;

    const selectNode = useCallback(
        (nodeId: string | null) => {
            navigate({
                search: (prev) => ({
                    ...prev,
                    selected: nodeId ?? undefined,
                }),
                replace: true,
            });
        },
        [navigate],
    );

    const openNode = useCallback(
        (nodeId: string) => {
            navigate({
                to: NOTE_ROUTE,
                params: { id: nodeId },
            });
        },
        [navigate],
    );

    return {
        selectedNodeId,
        selectNode,
        clearSelection: () => selectNode(null),
        openNode,
    };
}
