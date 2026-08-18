import { useSuspenseQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { fetchNoteGraph } from '~/apis/note.api';
import { QueryBoundary, QueryErrorView } from '~/components/app';
import { Empty, PageLayout, Skeleton } from '~/components/shared';
import { queryKeys } from '~/modules/query-key-factory';
import { GraphCanvas } from './GraphCanvas';
import { GraphCanvasControls } from './GraphCanvasControls';
import { GraphInsights } from './GraphInsights';
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
    const selectableNodes = useMemo(
        () => (graphData ? [...graphNodes, ...sortGraphNodes(graphData.isolatedNodes)] : []),
        [graphData, graphNodes],
    );
    const selectedNode = useMemo(
        () => getSelectedGraphNode(selectableNodes, selectedNodeId),
        [selectableNodes, selectedNodeId],
    );
    const selectedConnectedNodes = useMemo(
        () => getConnectedGraphNodes(selectableNodes, adjacencyMap, selectedNode?.id ?? null),
        [adjacencyMap, selectableNodes, selectedNode],
    );
    const hubNode = graphNodes[0] ?? null;
    const hubConnectedNodes = useMemo(
        () => getConnectedGraphNodes(selectableNodes, adjacencyMap, hubNode?.id ?? null),
        [adjacencyMap, hubNode, selectableNodes],
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
            <PageLayout title="Knowledge Graph" description="0 notes · 0 areas · 0 connections">
                <Empty title="No notes yet" description="Create a note to begin shaping your knowledge map" />
            </PageLayout>
        );
    }

    const totalNodeCount = graphData.nodes.length + graphData.isolatedNodes.length;
    const graphDescription = [
        `${totalNodeCount} notes`,
        `${graphData.links.length} ${graphData.links.length === 1 ? 'connection' : 'connections'}`,
        graphData.clusters.length > 1 ? `${graphData.clusters.length} areas` : null,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <PageLayout title="Knowledge Graph" description={graphDescription}>
            <div className="relative min-w-0">
                {graphData.nodes.length > 0 ? (
                    <>
                        <GraphCanvasControls
                            clusters={graphData.clusters}
                            focusedClusterId={activeClusterId}
                            hubConnectedNodes={hubConnectedNodes}
                            hubNode={hubNode}
                            onClearSelection={clearSelection}
                            onFocusCluster={handleFocusCluster}
                            onSelectNode={handleSelectNode}
                            selectedConnectedNodes={selectedConnectedNodes}
                            selectedNode={selectedNode}
                        />
                        <GraphCanvas
                            adjacencyMap={adjacencyMap}
                            focusedClusterId={activeClusterId}
                            graphData={graphData}
                            onClearFocus={handleClearMapFocus}
                            onOpenNode={openNode}
                            onSelectNode={handleSelectNode}
                            selectedNodeId={selectedNode?.id ?? null}
                        />
                    </>
                ) : (
                    <div className="surface-base flex h-[clamp(36rem,calc(100dvh-8rem),72rem)] w-full items-center justify-center p-6">
                        <Empty
                            title="No connections yet"
                            description="Browse unlinked notes and connect ideas from their note pages"
                        />
                    </div>
                )}
            </div>
            <GraphInsights isolatedNodes={graphData.isolatedNodes} />
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
