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
            const isCompactLayout = rect.width < 768;
            setDimensions({
                width: rect.width,
                height: isCompactLayout
                    ? Math.max(420, Math.min(520, rect.width * 1.25))
                    : Math.max(600, window.innerHeight - 150),
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
            graphRef.current?.zoomToFit(400, dimensions.width < 768 ? 80 : 50);
        }, 500);

        return () => window.clearTimeout(timeoutId);
    }, [dimensions.width, graphData]);

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

    const hubNodeCount = useMemo(() => graphNodes.filter((node) => node.connections >= 4).length, [graphNodes]);
    const visibleSelectedConnections = selectedConnectedNodes.slice(0, 4);
    const remainingSelectedConnectionCount = selectedConnectedNodes.length - visibleSelectedConnections.length;

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
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
                <div
                    ref={containerRef}
                    className="surface-base graph-canvas relative min-h-[420px] overflow-hidden md:min-h-[520px]"
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
                    className="surface-base flex max-h-none flex-col overflow-hidden xl:max-h-[min(44rem,calc(100vh-10rem))]"
                    aria-labelledby="graph-explorer-heading"
                >
                    <div className="border-b border-border-subtle/80 px-4 py-3.5">
                        <div className="flex items-start gap-3">
                            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-border-subtle bg-muted text-fg-secondary">
                                <Icon.Graph className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                                <Text id="graph-explorer-heading" as="h2" variant="body" weight="semibold">
                                    Graph Explorer
                                </Text>
                                <Text as="p" variant="meta" tone="tertiary" className="mt-0.5">
                                    Connection index
                                </Text>
                            </div>
                        </div>

                        <div className="mt-3 grid grid-cols-3 divide-x divide-border-subtle rounded-[12px] border border-border-subtle/80 bg-subtle/50">
                            <div className="px-2.5 py-2">
                                <Text as="p" variant="micro" tone="tertiary">
                                    Notes
                                </Text>
                                <Text as="p" variant="label" weight="semibold">
                                    {graphNodes.length}
                                </Text>
                            </div>
                            <div className="px-2.5 py-2">
                                <Text as="p" variant="micro" tone="tertiary">
                                    Links
                                </Text>
                                <Text as="p" variant="label" weight="semibold">
                                    {graphData.links.length}
                                </Text>
                            </div>
                            <div className="px-2.5 py-2">
                                <Text as="p" variant="micro" tone="tertiary">
                                    Hubs
                                </Text>
                                <Text as="p" variant="label" weight="semibold">
                                    {hubNodeCount}
                                </Text>
                            </div>
                        </div>
                    </div>

                    <div className="border-b border-border-subtle/80 px-4 py-3">
                        <label htmlFor="graph-node-search">
                            <Text as="span" variant="label" weight="medium" tone="secondary">
                                Search graph
                            </Text>
                        </label>
                        <div className="relative mt-1.5">
                            <Icon.Search
                                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-tertiary"
                                aria-hidden="true"
                            />
                            <Input
                                id="graph-node-search"
                                size="sm"
                                value={nodeSearchQuery}
                                onChange={(event) => setNodeSearchQuery(event.target.value)}
                                placeholder="Find a note"
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <Text id="graph-selection-status" as="p" role="status" aria-live="polite" className="sr-only">
                        {selectedNode
                            ? `${selectedNodeStatus}${
                                  selectedConnectedNodes.length > 0
                                      ? `. Linked to ${selectedConnectedNodes
                                            .map((node) => node.title || 'Untitled')
                                            .join(', ')}`
                                      : ''
                              }`
                            : selectedNodeStatus}
                    </Text>

                    <div className="border-b border-border-subtle/80 px-4 py-3">
                        {selectedNode ? (
                            <div className="min-w-0">
                                <Text as="p" variant="micro" tone="tertiary">
                                    Selected note
                                </Text>
                                <div className="mt-1 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <Text as="p" variant="body" weight="semibold" truncate>
                                            {selectedNode.title || 'Untitled'}
                                        </Text>
                                        <Text as="p" variant="meta" tone="tertiary" className="mt-0.5">
                                            {selectedNode.connections} links
                                        </Text>
                                    </div>
                                    <Link
                                        to={NOTE_ROUTE}
                                        params={{ id: selectedNode.id }}
                                        aria-label={`Open ${selectedNode.title || 'Untitled'}`}
                                        className="focus-ring-soft inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                                    >
                                        <Icon.ArrowRight className="h-4 w-4" aria-hidden="true" />
                                    </Link>
                                </div>
                                {visibleSelectedConnections.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {visibleSelectedConnections.map((node) => (
                                            <Link
                                                key={node.id}
                                                to={NOTE_ROUTE}
                                                params={{ id: node.id }}
                                                className="focus-ring-soft inline-flex max-w-full items-center gap-1 rounded-full border border-border-subtle bg-subtle px-2 py-0.5 text-xs font-medium text-fg-secondary outline-none transition-colors hover:border-border-secondary hover:bg-hover-subtle hover:text-fg-default"
                                            >
                                                <Icon.LinkIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                                                <span className="truncate">{node.title || 'Untitled'}</span>
                                            </Link>
                                        ))}
                                        {remainingSelectedConnectionCount > 0 && (
                                            <span className="inline-flex items-center rounded-full border border-border-subtle px-2 py-0.5 text-xs font-medium text-fg-tertiary">
                                                +{remainingSelectedConnectionCount}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <Text as="p" variant="micro" tone="tertiary">
                                    Overview
                                </Text>
                                <Text as="p" variant="body" weight="semibold" className="mt-1">
                                    No graph node selected
                                </Text>
                                <Text as="p" variant="meta" tone="tertiary" className="mt-0.5">
                                    {graphNodes[0]?.title ? `Most linked: ${graphNodes[0].title}` : 'No linked notes'}
                                </Text>
                            </div>
                        )}
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                            <Text as="h3" variant="label" weight="semibold">
                                Notes
                            </Text>
                            <Text as="span" variant="meta" tone="tertiary" className="shrink-0">
                                {filteredGraphNodes.length} shown
                            </Text>
                        </div>
                        {filteredGraphNodes.length > 0 ? (
                            <ul className="min-h-0 flex-1 overflow-y-auto border-t border-border-subtle/60">
                                {filteredGraphNodes.map((node) => {
                                    const isSelected = selectedNodeId === node.id;
                                    const nodeTitle = node.title || 'Untitled';

                                    return (
                                        <li key={node.id} className="border-b border-border-subtle/60 last:border-b-0">
                                            <div
                                                className={`grid grid-cols-[minmax(0,1fr)_auto] items-stretch transition-colors ${
                                                    isSelected
                                                        ? 'bg-elevated text-fg-default'
                                                        : 'text-fg-secondary hover:bg-hover-subtle hover:text-fg-default'
                                                }`}
                                            >
                                                <button
                                                    type="button"
                                                    aria-pressed={isSelected}
                                                    aria-describedby={isSelected ? 'graph-selection-status' : undefined}
                                                    onClick={() => setSelectedNodeId(node.id)}
                                                    className="focus-ring-soft group grid min-w-0 grid-cols-[3px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left outline-none"
                                                >
                                                    <span
                                                        className={`h-8 rounded-full transition-colors ${
                                                            isSelected
                                                                ? 'bg-fg-default'
                                                                : 'bg-border-subtle group-hover:bg-border-secondary'
                                                        }`}
                                                        aria-hidden="true"
                                                    />
                                                    <span className="min-w-0">
                                                        <Text as="span" variant="label" weight="medium" truncate>
                                                            {nodeTitle}
                                                        </Text>
                                                    </span>
                                                    <Text
                                                        as="span"
                                                        variant="meta"
                                                        tone={isSelected ? 'secondary' : 'tertiary'}
                                                        className="shrink-0"
                                                    >
                                                        <span aria-hidden="true">{node.connections}</span>
                                                        <span className="sr-only">{node.connections} links</span>
                                                    </Text>
                                                </button>
                                                <Link
                                                    to={NOTE_ROUTE}
                                                    params={{ id: node.id }}
                                                    aria-label={`Open ${nodeTitle}`}
                                                    className="focus-ring-soft m-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                                                >
                                                    <Icon.ArrowRight className="h-4 w-4" aria-hidden="true" />
                                                </Link>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <Text
                                as="p"
                                variant="meta"
                                tone="tertiary"
                                className="border-t border-border-subtle/60 px-4 py-5 text-center"
                            >
                                No matching graph nodes
                            </Text>
                        )}
                    </div>
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
