import { useSuspenseQuery } from '@tanstack/react-query';
import classNames from 'classnames';
import { useEffect, useMemo, useState } from 'react';

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
        <div className="mb-3 grid min-w-0 grid-cols-2 gap-2 xl:hidden" aria-hidden="true">
            <Skeleton width="100%" height={36} className="rounded-[12px]" />
            <Skeleton width="100%" height={36} className="rounded-[12px]" />
        </div>
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
            <div className="surface-base h-[min(34rem,calc(100dvh-12rem))] min-h-[420px] w-full max-w-full overflow-hidden md:h-[520px] xl:order-1 xl:h-[min(44rem,calc(100vh-10rem))]">
                <Skeleton width="100%" height="100%" />
            </div>
            <div className="surface-base hidden h-[min(34rem,calc(100dvh-12rem))] min-h-[420px] w-full max-w-full flex-col gap-3 p-4 md:h-[520px] xl:order-2 xl:flex xl:h-[min(44rem,calc(100vh-10rem))]">
                <div className="flex items-center justify-between gap-3">
                    <Skeleton width={120} height={14} className="rounded-full" />
                    <Skeleton width={92} height={12} className="rounded-full" />
                </div>
                <Skeleton width="100%" height={34} className="rounded-[12px]" />
                <Skeleton width="78%" height={12} className="rounded-full" />
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <Skeleton key={index} width="100%" height={40} className="rounded-[12px]" />
                    ))}
                </div>
            </div>
        </div>
    </PageLayout>
);

type GraphMobileTab = 'graph' | 'list';

function useIsGraphMobileLayout() {
    const [isMobileLayout, setIsMobileLayout] = useState(() =>
        typeof window === 'undefined' ? false : window.matchMedia('(max-width: 1279px)').matches,
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 1279px)');
        const handleChange = () => setIsMobileLayout(mediaQuery.matches);

        handleChange();
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return isMobileLayout;
}

function GraphContent() {
    const [nodeSearchQuery, setNodeSearchQuery] = useState('');
    const [activeMobileTab, setActiveMobileTab] = useState<GraphMobileTab>('graph');
    const isMobileLayout = useIsGraphMobileLayout();
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
        () => filterGraphNodes(graphNodes, nodeSearchQuery),
        [graphNodes, nodeSearchQuery],
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
            <div
                role="tablist"
                aria-label="Graph mobile view"
                className="surface-base mb-3 grid min-w-0 grid-cols-2 gap-1 p-1 xl:hidden"
            >
                <button
                    type="button"
                    role="tab"
                    id="graph-mobile-tab-graph"
                    aria-controls="graph-mobile-panel-graph"
                    aria-selected={activeMobileTab === 'graph'}
                    onClick={() => setActiveMobileTab('graph')}
                    className={classNames(
                        'focus-ring-soft rounded-[10px] px-3 py-2 text-sm font-semibold outline-none transition-colors',
                        activeMobileTab === 'graph'
                            ? 'bg-elevated text-fg-default shadow-sm'
                            : 'text-fg-secondary hover:bg-hover-subtle hover:text-fg-default',
                    )}
                >
                    Graph
                </button>
                <button
                    type="button"
                    role="tab"
                    id="graph-mobile-tab-list"
                    aria-controls="graph-mobile-panel-list"
                    aria-selected={activeMobileTab === 'list'}
                    onClick={() => setActiveMobileTab('list')}
                    className={classNames(
                        'focus-ring-soft rounded-[10px] px-3 py-2 text-sm font-semibold outline-none transition-colors',
                        activeMobileTab === 'list'
                            ? 'bg-elevated text-fg-default shadow-sm'
                            : 'text-fg-secondary hover:bg-hover-subtle hover:text-fg-default',
                    )}
                >
                    List
                </button>
            </div>
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
                <div
                    id="graph-mobile-panel-graph"
                    role="tabpanel"
                    aria-labelledby="graph-mobile-tab-graph"
                    aria-hidden={isMobileLayout && activeMobileTab !== 'graph'}
                    inert={isMobileLayout && activeMobileTab !== 'graph' ? true : undefined}
                    className={classNames(
                        'col-start-1 row-start-1 min-w-0 xl:col-auto xl:row-auto xl:order-1 xl:pointer-events-auto xl:visible',
                        activeMobileTab === 'graph' ? 'pointer-events-auto visible' : 'pointer-events-none invisible',
                    )}
                >
                    <GraphCanvas
                        adjacencyMap={adjacencyMap}
                        graphData={graphData}
                        onClearSelection={clearSelection}
                        onOpenNode={openNode}
                        onSelectNode={selectNode}
                        selectedNodeId={selectedNodeId}
                    />
                </div>
                <div
                    id="graph-mobile-panel-list"
                    role="tabpanel"
                    aria-labelledby="graph-mobile-tab-list"
                    aria-hidden={isMobileLayout && activeMobileTab !== 'list'}
                    inert={isMobileLayout && activeMobileTab !== 'list' ? true : undefined}
                    className={classNames(
                        'col-start-1 row-start-1 min-w-0 xl:col-auto xl:row-auto xl:order-2 xl:pointer-events-auto xl:visible',
                        activeMobileTab === 'list' ? 'pointer-events-auto visible' : 'pointer-events-none invisible',
                    )}
                >
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
