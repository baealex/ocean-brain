import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

import { fetchNoteGraph, type GraphLink, type GraphNode } from '~/apis/note.api';
import { QueryBoundary, QueryErrorView } from '~/components/app';
import * as Icon from '~/components/icon';
import { Empty, PageLayout, Skeleton } from '~/components/shared';
import { Input, Text } from '~/components/ui';
import { getHash } from '~/modules/hash';
import { queryKeys } from '~/modules/query-key-factory';
import { NOTE_ROUTE } from '~/modules/url';
import { useTheme } from '~/store/theme';
import { getGraphLabelFont, getGraphLinkColor, getGraphNodeFill, getGraphTheme } from './graph-theme';

interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

interface ForceGraphInstance {
    zoomToFit: (duration?: number, padding?: number) => void;
    enableZoomInteraction: (enable: boolean) => void;
}

function getNodeSize(connections: number) {
    if (connections <= 1) return 3.5;
    if (connections <= 3) return 4.5;
    if (connections <= 6) return 5.5;
    return Math.min(7, 5.5 + Math.sqrt(connections) * 0.5);
}

const graphPageFallback = (
    <PageLayout title="Knowledge Graph" description={<Skeleton width={184} height={16} className="rounded-full" />}>
        <div className="flex h-[600px] items-center justify-center">
            <Skeleton width="100%" height="100%" />
        </div>
    </PageLayout>
);

function GraphContent() {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<ForceGraphInstance | null>(null);
    const [dimensions, setDimensions] = useState({
        width: 800,
        height: 600,
    });
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [nodeSearchQuery, setNodeSearchQuery] = useState('');

    const { theme } = useTheme((state) => state);
    const graphTheme = getGraphTheme(theme);
    const graphThemeRef = useRef(graphTheme);
    graphThemeRef.current = graphTheme;

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

    const graphData: GraphData | null = useMemo(() => {
        if (data.nodes.length === 0) {
            return null;
        }

        const connectedNodes = data.nodes.filter((node) => node.connections > 0);
        if (connectedNodes.length === 0) {
            return null;
        }

        const connectedIds = new Set(connectedNodes.map((node) => node.id));
        return {
            nodes: connectedNodes,
            links: data.links.filter((link) => connectedIds.has(link.source) && connectedIds.has(link.target)),
        };
    }, [data]);

    useEffect(() => {
        if (!graphData) {
            return;
        }

        const updateDimensions = () => {
            if (!containerRef.current) {
                return;
            }

            const rect = containerRef.current.getBoundingClientRect();
            setDimensions({
                width: rect.width,
                height: Math.max(600, window.innerHeight - 150),
            });
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, [graphData]);

    useEffect(() => {
        if (!graphData || !graphRef.current) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            graphRef.current?.zoomToFit(400, 50);
        }, 500);

        return () => window.clearTimeout(timeoutId);
    }, [graphData]);

    const selectedNodeIdRef = useRef(selectedNodeId);
    selectedNodeIdRef.current = selectedNodeId;

    const handleNodeClick = useCallback(
        (node: GraphNode) => {
            if (selectedNodeIdRef.current === node.id) {
                navigate({
                    to: NOTE_ROUTE,
                    params: { id: node.id },
                });
                return;
            }

            setSelectedNodeId(node.id);
        },
        [navigate],
    );

    const handleBackgroundClick = useCallback(() => {
        setSelectedNodeId(null);
    }, []);

    const handleNodeHover = useCallback((node: GraphNode | null) => {
        if (containerRef.current) {
            containerRef.current.style.cursor = node ? 'pointer' : 'default';
        }
    }, []);

    const isDraggingRef = useRef(false);

    const handleNodeDrag = useCallback(() => {
        if (!isDraggingRef.current) {
            isDraggingRef.current = true;
            graphRef.current?.enableZoomInteraction(false);
        }
    }, []);

    const handleNodeDragEnd = useCallback(() => {
        isDraggingRef.current = false;
        graphRef.current?.enableZoomInteraction(true);
    }, []);

    const adjacencyMapRef = useRef(new Map<string, Set<string>>());
    const adjacencyMap = useMemo(() => {
        const map = new Map<string, Set<string>>();
        if (graphData) {
            for (const link of graphData.links) {
                if (!map.has(link.source)) map.set(link.source, new Set());
                if (!map.has(link.target)) map.set(link.target, new Set());
                map.get(link.source)?.add(link.target);
                map.get(link.target)?.add(link.source);
            }
        }
        return map;
    }, [graphData]);
    adjacencyMapRef.current = adjacencyMap;

    const graphNodes = useMemo(() => {
        if (!graphData) {
            return [];
        }

        return [...graphData.nodes].sort((a, b) => b.connections - a.connections || a.title.localeCompare(b.title));
    }, [graphData]);

    const filteredGraphNodes = useMemo(() => {
        const query = nodeSearchQuery.trim().toLowerCase();
        if (!query) {
            return graphNodes;
        }

        return graphNodes.filter((node) => node.title.toLowerCase().includes(query));
    }, [graphNodes, nodeSearchQuery]);

    const selectedNode = useMemo(() => {
        if (!selectedNodeId) {
            return null;
        }

        return graphNodes.find((node) => node.id === selectedNodeId) ?? null;
    }, [graphNodes, selectedNodeId]);

    const selectedConnectedNodes = useMemo(() => {
        if (!selectedNodeId) {
            return [];
        }

        const connectedIds = adjacencyMap.get(selectedNodeId);
        if (!connectedIds) {
            return [];
        }

        return graphNodes.filter((node) => connectedIds.has(node.id));
    }, [adjacencyMap, graphNodes, selectedNodeId]);

    const selectedNodeStatus = selectedNode
        ? `${selectedNode.title || 'Untitled'} selected, ${selectedNode.connections} links`
        : 'No graph node selected';

    const nodeCanvasObject = useCallback(
        (node: GraphNode & { x?: number; y?: number }, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const palette = graphThemeRef.current;
            const selectedId = selectedNodeId;
            const adjacency = adjacencyMapRef.current;
            const nodeSize = getNodeSize(node.connections);
            const nx = node.x || 0;
            const ny = node.y || 0;

            const isSelected = selectedId === node.id;
            const isConnected = selectedId ? (adjacency.get(selectedId)?.has(node.id) ?? false) : false;
            const isDimmed = selectedId !== null && !isSelected && !isConnected;
            const colorIndex = getHash(node.id);

            ctx.beginPath();
            ctx.arc(nx, ny, nodeSize, 0, Math.PI * 2);

            ctx.fillStyle = getGraphNodeFill(theme, {
                connections: node.connections,
                colorIndex,
                selectedNodeId: selectedId,
                nodeId: node.id,
                isConnected,
            });
            ctx.fill();

            if (isDimmed) {
                return;
            }

            ctx.strokeStyle = palette.nodeStroke;
            ctx.lineWidth = (isSelected ? 2 : 1) / globalScale;
            ctx.stroke();

            if (isSelected) {
                ctx.beginPath();
                ctx.arc(nx, ny, nodeSize + 2 / globalScale, 0, Math.PI * 2);
                ctx.strokeStyle = palette.nodeSelectedStroke;
                ctx.lineWidth = 1.5 / globalScale;
                ctx.stroke();
            }

            const isHubConnected = isConnected && node.connections >= 4;
            if (isSelected || isHubConnected || globalScale > 2.5) {
                const label = node.title || 'Untitled';
                const fontSize = Math.max(10 / globalScale, 2.5);
                ctx.font = getGraphLabelFont(theme, {
                    fontSize,
                    emphasize: isSelected,
                });
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';

                const textWidth = ctx.measureText(label).width;
                const padding = 2 / globalScale;
                const labelY = ny + nodeSize + 3 / globalScale;

                ctx.fillStyle = palette.labelBackground;
                ctx.fillRect(nx - textWidth / 2 - padding, labelY, textWidth + padding * 2, fontSize + padding * 2);

                ctx.fillStyle = palette.labelText;
                ctx.fillText(label, nx, labelY + padding);
            }
        },
        [selectedNodeId, theme],
    );

    const linkCanvasObject = useCallback(
        (link: GraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const selectedId = selectedNodeId;
            const source = link.source as unknown as { x?: number; y?: number; id: string };
            const target = link.target as unknown as { x?: number; y?: number; id: string };
            const isConnected = selectedId ? source.id === selectedId || target.id === selectedId : false;

            ctx.beginPath();
            ctx.moveTo(source.x || 0, source.y || 0);
            ctx.lineTo(target.x || 0, target.y || 0);

            ctx.strokeStyle = getGraphLinkColor(theme, {
                selectedNodeId: selectedId,
                isConnected,
            });
            ctx.lineWidth = isConnected ? 2 / globalScale : 0.5 / globalScale;
            ctx.stroke();
        },
        [selectedNodeId, theme],
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
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div
                    ref={containerRef}
                    className="surface-base graph-canvas relative overflow-hidden"
                    style={{ '--graph-bg': graphTheme.background } as React.CSSProperties}
                >
                    {selectedNode && (
                        <div className="surface-floating absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-2">
                            <Text as="span" variant="meta" weight="semibold" truncate className="max-w-48">
                                {selectedNode.title}
                            </Text>
                            <Text as="span" variant="label" tone="tertiary">
                                {selectedNode.connections} links
                            </Text>
                            <button
                                type="button"
                                onClick={() => setSelectedNodeId(null)}
                                className="focus-ring-soft ml-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-[8px] text-fg-tertiary transition-colors hover:bg-hover-subtle hover:text-fg-default"
                                aria-label="Deselect node"
                            >
                                <Icon.Close className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                    <div className="surface-floating absolute top-3 right-3 z-10 flex flex-col gap-1.5 px-3 py-2.5">
                        <div className="flex items-center gap-2">
                            <span
                                className="legend-dot h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ '--legend-color': graphTheme.legendHub } as React.CSSProperties}
                            />
                            <Text as="span" variant="label" weight="medium" tone="secondary">
                                Hub notes (4+ connections)
                            </Text>
                        </div>
                        <div className="flex items-center gap-2">
                            <span
                                className="legend-dot h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ '--legend-color': graphTheme.nodeConnected } as React.CSSProperties}
                            />
                            <Text as="span" variant="label" weight="medium" tone="secondary">
                                Connected notes
                            </Text>
                        </div>
                    </div>
                    <div aria-hidden="true">
                        <ForceGraph2D
                            ref={graphRef as React.MutableRefObject<never>}
                            graphData={graphData}
                            width={dimensions.width}
                            height={dimensions.height}
                            nodeId="id"
                            nodeLabel=""
                            nodeCanvasObject={nodeCanvasObject}
                            nodePointerAreaPaint={(node: GraphNode & { x?: number; y?: number }, color, ctx) => {
                                ctx.beginPath();
                                ctx.arc(
                                    node.x || 0,
                                    node.y || 0,
                                    Math.max(getNodeSize(node.connections) + 4, 10),
                                    0,
                                    2 * Math.PI,
                                );
                                ctx.fillStyle = color;
                                ctx.fill();
                            }}
                            linkCanvasObject={linkCanvasObject}
                            linkCanvasObjectMode={() => 'replace'}
                            linkDirectionalParticles={0}
                            onNodeClick={handleNodeClick}
                            onNodeHover={handleNodeHover}
                            onBackgroundClick={handleBackgroundClick}
                            onNodeDrag={handleNodeDrag}
                            onNodeDragEnd={handleNodeDragEnd}
                            warmupTicks={30}
                            cooldownTicks={80}
                            d3AlphaDecay={0.05}
                            d3VelocityDecay={0.3}
                            enableZoomInteraction={true}
                            enablePanInteraction={true}
                            minZoom={0.3}
                            maxZoom={5}
                        />
                    </div>
                </div>

                <section
                    className="surface-base flex max-h-[min(42rem,calc(100vh-10rem))] flex-col overflow-hidden px-4 py-3"
                    aria-labelledby="graph-node-list-heading"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <Text id="graph-node-list-heading" as="h2" variant="body" weight="semibold">
                                Graph nodes
                            </Text>
                            <Text as="p" variant="meta" tone="tertiary" className="mt-0.5">
                                {filteredGraphNodes.length} of {graphNodes.length} notes
                            </Text>
                        </div>
                        <Text as="span" variant="label" tone="secondary" className="shrink-0">
                            {graphData.links.length} links
                        </Text>
                    </div>

                    <label htmlFor="graph-node-search" className="sr-only">
                        Search graph nodes
                    </label>
                    <Input
                        id="graph-node-search"
                        size="sm"
                        value={nodeSearchQuery}
                        onChange={(event) => setNodeSearchQuery(event.target.value)}
                        placeholder="Search graph nodes"
                        className="mt-3"
                    />

                    <div
                        id="graph-selection-status"
                        role="status"
                        aria-live="polite"
                        className="mt-3 rounded-[14px] border border-border-subtle bg-subtle px-3 py-2"
                    >
                        <Text as="p" variant="label" weight="medium">
                            {selectedNodeStatus}
                        </Text>
                        {selectedConnectedNodes.length > 0 && (
                            <Text as="p" variant="meta" tone="tertiary" truncate className="mt-0.5">
                                Linked to {selectedConnectedNodes.map((node) => node.title || 'Untitled').join(', ')}
                            </Text>
                        )}
                    </div>

                    {filteredGraphNodes.length > 0 ? (
                        <ul
                            className="mt-3 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto"
                            aria-label="Graph node list"
                        >
                            {filteredGraphNodes.map((node) => {
                                const isSelected = selectedNodeId === node.id;

                                return (
                                    <li key={node.id}>
                                        <Link
                                            to={NOTE_ROUTE}
                                            params={{ id: node.id }}
                                            aria-describedby={isSelected ? 'graph-selection-status' : undefined}
                                            onFocus={() => setSelectedNodeId(node.id)}
                                            className={`focus-ring-soft flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2 text-left outline-none transition-colors ${
                                                isSelected
                                                    ? 'border-border-secondary bg-elevated text-fg-default'
                                                    : 'border-border-subtle bg-transparent text-fg-secondary hover:border-border-secondary hover:bg-elevated hover:text-fg-default'
                                            }`}
                                        >
                                            <Text as="span" variant="label" weight="medium" truncate>
                                                {node.title || 'Untitled'}
                                            </Text>
                                            <Text
                                                as="span"
                                                variant="meta"
                                                tone={isSelected ? 'secondary' : 'tertiary'}
                                                className="shrink-0"
                                            >
                                                {node.connections} links
                                            </Text>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <Text
                            as="p"
                            variant="meta"
                            tone="tertiary"
                            className="mt-3 rounded-[14px] border border-dashed border-border-subtle px-3 py-4 text-center"
                        >
                            No matching graph nodes
                        </Text>
                    )}
                </section>
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
