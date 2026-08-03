import { useSuspenseQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { fetchNoteGraph } from '~/apis/note.api';
import { QueryBoundary, QueryErrorView } from '~/components/app';
import { Empty, PageLayout, Skeleton } from '~/components/shared';
import { queryKeys } from '~/modules/query-key-factory';
import { GraphCanvas } from './GraphCanvas';
import { GraphMapOverlay } from './GraphMapOverlay';
import {
    createAdjacencyMap,
    createConnectionMapData,
    getConnectedGraphNodes,
    getSelectedGraphNode,
    sortGraphNodes,
} from './graph-data';
import { useGraphSelection } from './useGraphSelection';

const graphPageFallback = (
    <PageLayout title="Knowledge Graph" description={<Skeleton width={184} height={16} className="rounded-full" />}>
        <div className="surface-base relative h-[clamp(36rem,calc(100dvh-8rem),72rem)] w-full overflow-hidden">
            <Skeleton width="100%" height="100%" />
            <div className="surface-floating absolute top-3 left-3 w-56 space-y-2 p-3" aria-hidden="true">
                <Skeleton width={92} height={14} className="rounded-full" />
                <Skeleton width="100%" height={32} className="rounded-[10px]" />
                <Skeleton width="82%" height={32} className="rounded-[10px]" />
            </div>
        </div>
    </PageLayout>
);

function GraphContent() {
    const [focusedClusterId, setFocusedClusterId] = useState<string | null>(null);
    const { clearSelection, openNode, selectNode, selectedNodeId } = useGraphSelection();

    const { data } = useSuspenseQuery({
        queryKey: queryKeys.notes.graph(),
        queryFn: async () => {
            const response = await fetchNoteGraph();
            if (response.type === 'error') {
                throw response;
            }
            return response.noteGraph;
        },
    });

    const graphData = useMemo(() => createConnectionMapData(data), [data]);
    const adjacencyMap = useMemo(
        () => (graphData ? createAdjacencyMap(graphData.links) : new Map<string, Set<string>>()),
        [graphData],
    );
    const graphNodes = useMemo(() => (graphData ? sortGraphNodes(graphData.nodes) : []), [graphData]);
    const selectedNode = useMemo(() => getSelectedGraphNode(graphNodes, selectedNodeId), [graphNodes, selectedNodeId]);
    const selectedConnectedNodes = useMemo(
        () => getConnectedGraphNodes(graphNodes, adjacencyMap, selectedNode?.id ?? null),
        [adjacencyMap, graphNodes, selectedNode],
    );
    const activeClusterId = graphData?.clusters.some((cluster) => cluster.id === focusedClusterId)
        ? focusedClusterId
        : null;

    const handleSelectNode = useCallback(
        (nodeId: string) => {
            setFocusedClusterId(null);
            selectNode(nodeId);
        },
        [selectNode],
    );

    const handleFocusCluster = useCallback(
        (clusterId: string) => {
            clearSelection();
            setFocusedClusterId((currentClusterId) => (currentClusterId === clusterId ? null : clusterId));
        },
        [clearSelection],
    );

    const handleClearMapFocus = useCallback(() => {
        setFocusedClusterId(null);
        clearSelection();
    }, [clearSelection]);

    if (!graphData) {
        return (
            <PageLayout title="Knowledge Graph" description="0 linked notes, 0 connections">
                <Empty title="No map yet" description="Connect two notes to begin shaping your knowledge map" />
            </PageLayout>
        );
    }

    return (
        <PageLayout
            title="Knowledge Graph"
            description={`${graphData.nodes.length} linked notes · ${graphData.clusters.length} areas · ${graphData.links.length} connections`}
        >
            <div className="relative min-w-0">
                <GraphCanvas
                    adjacencyMap={adjacencyMap}
                    focusedClusterId={activeClusterId}
                    graphData={graphData}
                    onClearFocus={handleClearMapFocus}
                    onOpenNode={openNode}
                    onSelectNode={handleSelectNode}
                    selectedNodeId={selectedNode?.id ?? null}
                />
                <GraphMapOverlay
                    clusters={graphData.clusters}
                    focusedClusterId={activeClusterId}
                    onClearSelection={clearSelection}
                    onFocusCluster={handleFocusCluster}
                    onSelectNode={handleSelectNode}
                    selectedConnectedNodes={selectedConnectedNodes}
                    selectedNode={selectedNode}
                />
            </div>
        </PageLayout>
    );
}

export default function Graph() {
    return (
        <QueryBoundary
            fallback={graphPageFallback}
            errorTitle="Failed to load graph"
            errorDescription="Retry loading your linked note constellation"
            renderError={({ error, retry }) => (
                <PageLayout title="Knowledge Graph">
                    <QueryErrorView
                        title="Failed to load graph"
                        description="Retry loading your linked note constellation"
                        error={error}
                        onRetry={retry}
                    />
                </PageLayout>
            )}
        >
            <GraphContent />
        </QueryBoundary>
    );
}
