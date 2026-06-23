import { useSuspenseQuery } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';

import { fetchNoteGraph } from '~/apis/note.api';
import { QueryBoundary, QueryErrorView } from '~/components/app';
import { Empty, PageLayout, Skeleton } from '~/components/shared';
import { queryKeys } from '~/modules/query-key-factory';
import { GraphCanvas } from './GraphCanvas';
import { GraphExplorerPanel } from './GraphExplorerPanel';
import {
    createAdjacencyMap,
    createConnectedGraphData,
    filterGraphNodes,
    getConnectedGraphNodes,
    getSelectedGraphNode,
    sortGraphNodes,
} from './graph-data';
import { useGraphSelection } from './useGraphSelection';

const graphPageFallback = (
    <PageLayout title="Knowledge Graph" description={<Skeleton width={184} height={16} className="rounded-full" />}>
        <div className="flex h-[600px] items-center justify-center">
            <Skeleton width="100%" height="100%" />
        </div>
    </PageLayout>
);

function GraphContent() {
    const [nodeSearchQuery, setNodeSearchQuery] = useState('');
    const deferredNodeSearchQuery = useDeferredValue(nodeSearchQuery);
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

    const graphData = useMemo(() => createConnectedGraphData(data), [data]);
    const adjacencyMap = useMemo(
        () => (graphData ? createAdjacencyMap(graphData.links) : new Map<string, Set<string>>()),
        [graphData],
    );
    const graphNodes = useMemo(() => (graphData ? sortGraphNodes(graphData.nodes) : []), [graphData]);
    const filteredGraphNodes = useMemo(
        () => filterGraphNodes(graphNodes, deferredNodeSearchQuery),
        [deferredNodeSearchQuery, graphNodes],
    );
    const selectedNode = useMemo(() => getSelectedGraphNode(graphNodes, selectedNodeId), [graphNodes, selectedNodeId]);
    const selectedConnectedNodes = useMemo(
        () => getConnectedGraphNodes(graphNodes, adjacencyMap, selectedNodeId),
        [adjacencyMap, graphNodes, selectedNodeId],
    );

    if (!graphData) {
        return (
            <PageLayout title="Knowledge Graph" description="0 linked notes, 0 connections">
                <Empty
                    title="No constellations yet"
                    description="Link your notes together and watch your own starry sky unfold"
                />
            </PageLayout>
        );
    }

    return (
        <PageLayout
            title="Knowledge Graph"
            description={`${graphData.nodes.length} linked notes, ${graphData.links.length} connections`}
        >
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
                <GraphCanvas
                    adjacencyMap={adjacencyMap}
                    graphData={graphData}
                    onClearSelection={clearSelection}
                    onOpenNode={openNode}
                    onSelectNode={selectNode}
                    selectedNodeId={selectedNodeId}
                />
                <GraphExplorerPanel
                    filteredGraphNodes={filteredGraphNodes}
                    graphNodes={graphNodes}
                    nodeSearchQuery={nodeSearchQuery}
                    onClearSelection={clearSelection}
                    onNodeSearchQueryChange={setNodeSearchQuery}
                    onSelectNode={selectNode}
                    selectedConnectedNodes={selectedConnectedNodes}
                    selectedNode={selectedNode}
                    selectedNodeId={selectedNodeId}
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
