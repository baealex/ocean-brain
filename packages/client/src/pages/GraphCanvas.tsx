import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { type ForceGraphMethods, type LinkObject, type NodeObject } from 'react-force-graph-2d';

import * as Icon from '~/components/icon';
import { useTheme } from '~/store/theme';
import { type GraphData, type GraphVisualNode, getNodeSize } from './graph-data';
import { getGraphAreaShape, getGraphViewportFit } from './graph-fit';
import {
    clampGraphLabelCenter,
    doGraphLabelBoundsOverlap,
    GRAPH_DIMMED_LABEL_OPACITY,
    type GraphLabelBounds,
    getGraphAreaLabelText,
    getGraphNodeFocusState,
    getGraphNodeLabelText,
    shouldShowGraphNodeLabel,
} from './graph-labels';
import {
    getGraphClusterAreaFill,
    getGraphClusterLabelColor,
    getGraphLabelFont,
    getGraphLinkColor,
    getGraphNodeFill,
    getGraphTheme,
} from './graph-theme';

type CanvasNode = NodeObject<GraphVisualNode>;
type CanvasLink = LinkObject<GraphVisualNode, object>;

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 5;
const AREA_LABEL_FONT_SIZE = 11;
const AREA_LABEL_EDGE_MARGIN = 8;
// Clears the floating zoom controls (12px inset + 40px buttons) when fitting the map.
const ZOOM_CONTROLS_CLEARANCE = 60;

type ClusterForce = ((alpha: number) => void) & {
    initialize: (nodes: CanvasNode[]) => void;
};

interface GraphCanvasProps {
    adjacencyMap: Map<string, Set<string>>;
    focusedClusterId: string | null;
    graphData: GraphData;
    onClearFocus: () => void;
    onOpenNode: (nodeId: string) => void;
    onSelectNode: (nodeId: string) => void;
    selectedNodeId: string | null;
}

function createClusterForce(): ClusterForce {
    let nodes: CanvasNode[] = [];
    const force = ((alpha: number) => {
        const strength = 0.22 * alpha;
        for (const node of nodes) {
            const x = node.x ?? node.clusterX;
            const y = node.y ?? node.clusterY;
            node.vx = (node.vx ?? 0) + (node.clusterX - x) * strength;
            node.vy = (node.vy ?? 0) + (node.clusterY - y) * strength;
        }
    }) as ClusterForce;

    force.initialize = (nextNodes) => {
        nodes = nextNodes;
    };

    return force;
}

function getEndpointNode(endpoint: string | number | CanvasNode | undefined) {
    return typeof endpoint === 'object' && endpoint !== null ? endpoint : null;
}

function getEndpointId(endpoint: string | number | CanvasNode | undefined) {
    if (typeof endpoint === 'object' && endpoint !== null) {
        return String(endpoint.id ?? '');
    }

    return endpoint == null ? '' : String(endpoint);
}

export function GraphCanvas({
    adjacencyMap,
    focusedClusterId,
    graphData,
    onClearFocus,
    onOpenNode,
    onSelectNode,
    selectedNodeId,
}: GraphCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<ForceGraphMethods<GraphVisualNode, object> | undefined>(undefined);
    const [dimensions, setDimensions] = useState({
        width: 0,
        height: 576,
    });
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    const { theme } = useTheme((state) => state);
    const graphTheme = getGraphTheme(theme);
    const graphThemeRef = useRef(graphTheme);
    graphThemeRef.current = graphTheme;

    const selectedNodeIdRef = useRef(selectedNodeId);
    selectedNodeIdRef.current = selectedNodeId;

    const focusedClusterIdRef = useRef(focusedClusterId);
    focusedClusterIdRef.current = focusedClusterId;

    const adjacencyMapRef = useRef(adjacencyMap);
    adjacencyMapRef.current = adjacencyMap;

    const clusterByNodeId = useMemo(
        () => new Map(graphData.nodes.map((node) => [node.id, node.clusterId])),
        [graphData],
    );
    const clusterByNodeIdRef = useRef(clusterByNodeId);
    clusterByNodeIdRef.current = clusterByNodeId;

    const nodesByCluster = useMemo(() => {
        const groupedNodes = new Map<string, CanvasNode[]>();
        for (const node of graphData.nodes) {
            const clusterNodes = groupedNodes.get(node.clusterId) ?? [];
            clusterNodes.push(node);
            groupedNodes.set(node.clusterId, clusterNodes);
        }
        return groupedNodes;
    }, [graphData]);
    const nodeById = useMemo(() => new Map(graphData.nodes.map((node) => [node.id, node])), [graphData]);
    const labelPriorityNodes = useMemo(
        () =>
            [...graphData.nodes].sort(
                (first, second) =>
                    Number(second.isClusterHub) - Number(first.isClusterHub) ||
                    second.connections - first.connections ||
                    first.title.localeCompare(second.title),
            ),
        [graphData],
    );

    useEffect(() => {
        const updateDimensions = () => {
            if (!containerRef.current) {
                return;
            }

            const rect = containerRef.current.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) {
                return;
            }

            setDimensions({
                width: rect.width,
                height: rect.height,
            });
        };

        updateDimensions();

        const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(updateDimensions) : null;
        if (resizeObserver && containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        window.addEventListener('resize', updateDimensions);
        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener('resize', updateDimensions);
        };
    }, []);

    useEffect(() => {
        const graph = graphRef.current;
        if (!graph) {
            return;
        }

        graph.d3Force('center', null);
        graph.d3Force('connection-area', createClusterForce());
        graph.d3ReheatSimulation();

        return () => {
            graph.d3Force('connection-area', null);
        };
    }, [graphData]);

    const fitGraph = useCallback(() => {
        const graph = graphRef.current;
        if (!graph) {
            return;
        }

        const prefersReducedMotion =
            typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const duration = prefersReducedMotion ? 0 : 360;
        const edgePadding = dimensions.width < 768 ? 24 : 64;
        const areas = graphData.clusters.flatMap((cluster) => {
            const nodes = nodesByCluster.get(cluster.id) ?? [];
            return nodes.length > 0 ? [getGraphAreaShape(nodes, cluster)] : [];
        });
        const fit = getGraphViewportFit({
            areas,
            width: dimensions.width,
            height: dimensions.height,
            padding: {
                top: Math.max(edgePadding, ZOOM_CONTROLS_CLEARANCE),
                right: edgePadding,
                bottom: edgePadding,
                left: edgePadding,
            },
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
        });

        if (!fit) {
            graph.zoomToFit(duration, edgePadding);
            return;
        }

        graph.centerAt(fit.centerX, fit.centerY, duration);
        graph.zoom(fit.zoom, duration);
    }, [dimensions.height, dimensions.width, graphData.clusters, nodesByCluster]);

    const zoomGraph = useCallback((factor: number) => {
        const graph = graphRef.current;
        if (!graph) {
            return;
        }

        graph.zoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, graph.zoom() * factor)), 180);
    }, []);

    useEffect(() => {
        const timeoutId = window.setTimeout(fitGraph, 520);
        return () => window.clearTimeout(timeoutId);
    }, [fitGraph]);

    const handleNodeClick = useCallback(
        (node: CanvasNode) => {
            if (selectedNodeIdRef.current === node.id) {
                onOpenNode(String(node.id));
                return;
            }

            onSelectNode(String(node.id));
        },
        [onOpenNode, onSelectNode],
    );

    const handleNodeHover = useCallback((node: CanvasNode | null) => {
        setHoveredNodeId(node ? String(node.id) : null);
        if (containerRef.current) {
            containerRef.current.style.cursor = node ? 'pointer' : 'default';
        }
    }, []);

    const drawClusterRegions = useCallback(
        (ctx: CanvasRenderingContext2D, globalScale: number) => {
            const selectedClusterId = selectedNodeId ? (clusterByNodeIdRef.current.get(selectedNodeId) ?? null) : null;
            const focusedId = focusedClusterIdRef.current;

            for (const cluster of graphData.clusters) {
                const nodes = nodesByCluster.get(cluster.id) ?? [];
                if (nodes.length === 0) {
                    continue;
                }

                const { centerX, centerY, radiusX, radiusY } = getGraphAreaShape(nodes, cluster);
                const transform = ctx.getTransform();
                const areaBounds = {
                    left: transform.a * (centerX - radiusX) + transform.e,
                    right: transform.a * (centerX + radiusX) + transform.e,
                    top: transform.d * (centerY - radiusY) + transform.f,
                    bottom: transform.d * (centerY + radiusY) + transform.f,
                };

                // Offscreen areas must not leave their clamped labels behind at the canvas edge.
                if (
                    !doGraphLabelBoundsOverlap(areaBounds, {
                        left: 0,
                        top: 0,
                        right: ctx.canvas.width,
                        bottom: ctx.canvas.height,
                    })
                ) {
                    continue;
                }

                const isFocused = focusedId === cluster.id || selectedClusterId === cluster.id;
                const isDimmed = Boolean(
                    (focusedId && focusedId !== cluster.id) || (selectedClusterId && selectedClusterId !== cluster.id),
                );

                ctx.save();
                ctx.beginPath();
                ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
                ctx.fillStyle = getGraphClusterAreaFill(theme, cluster.colorIndex, { isFocused, isDimmed });
                ctx.fill();

                if (!isDimmed) {
                    const fontSize = Math.max(AREA_LABEL_FONT_SIZE / globalScale, 3);
                    const labelText = getGraphAreaLabelText(cluster);
                    ctx.font = getGraphLabelFont(theme, { fontSize, emphasize: isFocused });
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillStyle = getGraphClusterLabelColor(theme, cluster.colorIndex);
                    // Area labels can be wider than their area, so keep them inside the canvas instead of clipping.
                    const edgeMargin = AREA_LABEL_EDGE_MARGIN * (transform.a / globalScale);
                    const labelCenterX = clampGraphLabelCenter(
                        transform.a * centerX + transform.e,
                        ctx.measureText(labelText).width * transform.a,
                        edgeMargin,
                        ctx.canvas.width - edgeMargin,
                    );
                    ctx.fillText(
                        labelText,
                        (labelCenterX - transform.e) / transform.a,
                        centerY - radiusY + 12 / globalScale,
                    );
                }
                ctx.restore();
            }
        },
        [graphData.clusters, nodesByCluster, selectedNodeId, theme],
    );

    const nodeCanvasObject = useCallback(
        (node: CanvasNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const palette = graphThemeRef.current;
            const nodeSize = getNodeSize(node.connections);
            const nx = node.x ?? 0;
            const ny = node.y ?? 0;

            const { isSelected, isHovered, isConnected, isDimmed } = getGraphNodeFocusState(
                { id: String(node.id), clusterId: node.clusterId },
                {
                    adjacency: adjacencyMapRef.current,
                    focusedClusterId: focusedClusterIdRef.current,
                    hoveredNodeId,
                    selectedNodeId: selectedNodeIdRef.current,
                },
            );

            ctx.beginPath();
            ctx.arc(nx, ny, nodeSize, 0, Math.PI * 2);
            ctx.fillStyle = getGraphNodeFill(theme, {
                colorIndex: node.clusterColorIndex,
                isDimmed,
            });
            ctx.fill();

            if (isDimmed) {
                return;
            }

            ctx.strokeStyle = isConnected
                ? palette.nodeConnectedStroke
                : isHovered
                  ? palette.nodeSelectedStroke
                  : palette.nodeStroke;
            ctx.lineWidth = (isSelected ? 2 : isHovered ? 1.5 : 1) / globalScale;
            ctx.stroke();

            if (isSelected || isHovered) {
                ctx.beginPath();
                ctx.arc(nx, ny, nodeSize + 3 / globalScale, 0, Math.PI * 2);
                ctx.strokeStyle = palette.nodeSelectedStroke;
                ctx.lineWidth = (isSelected ? 1.5 : 1) / globalScale;
                ctx.stroke();
            }
        },
        [hoveredNodeId, theme],
    );

    const drawNodeLabels = useCallback(
        (ctx: CanvasRenderingContext2D, globalScale: number) => {
            const palette = graphThemeRef.current;
            const selectedId = selectedNodeIdRef.current;
            const focusOptions = {
                adjacency: adjacencyMapRef.current,
                focusedClusterId: focusedClusterIdRef.current,
                hoveredNodeId,
                selectedNodeId: selectedId,
            };
            const focusStates = new Map(
                labelPriorityNodes.map((node) => [node.id, getGraphNodeFocusState(node, focusOptions)]),
            );
            const orderedNodes: GraphVisualNode[] = [];
            const addedNodeIds = new Set<string>();
            const addNode = (node: GraphVisualNode | undefined) => {
                if (node && !addedNodeIds.has(node.id)) {
                    orderedNodes.push(node);
                    addedNodeIds.add(node.id);
                }
            };

            // Active notes claim label space first so faded labels never hide them.
            addNode(selectedId ? nodeById.get(selectedId) : undefined);
            addNode(hoveredNodeId ? nodeById.get(hoveredNodeId) : undefined);
            for (const node of labelPriorityNodes) {
                if (focusStates.get(node.id)?.isConnected) {
                    addNode(node);
                }
            }
            for (const node of labelPriorityNodes) {
                if (!focusStates.get(node.id)?.isDimmed) {
                    addNode(node);
                }
            }
            for (const node of labelPriorityNodes) {
                addNode(node);
            }

            const occupiedBounds: GraphLabelBounds[] = [];
            for (const node of orderedNodes) {
                const focusState = focusStates.get(node.id);
                if (!focusState) {
                    continue;
                }

                const { isSelected, isHovered, isConnected, isDimmed } = focusState;
                if (!shouldShowGraphNodeLabel(node, { globalScale, isConnected, isHovered, isSelected })) {
                    continue;
                }

                const isEmphasized = isSelected || isHovered || node.isClusterHub;
                const label = getGraphNodeLabelText(node.title, { globalScale, isEmphasized });
                const fontSize = Math.max((isEmphasized ? 11.5 : 10.5) / globalScale, 2.4);
                ctx.font = getGraphLabelFont(theme, { fontSize, emphasize: isEmphasized });
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';

                const textWidth = ctx.measureText(label).width;
                const horizontalPadding = 3 / globalScale;
                const verticalPadding = 2 / globalScale;
                const x = node.x ?? 0;
                const y = (node.y ?? 0) + getNodeSize(node.connections) + 3 / globalScale;
                const bounds = {
                    left: x - textWidth / 2 - horizontalPadding,
                    top: y,
                    right: x + textWidth / 2 + horizontalPadding,
                    bottom: y + fontSize + verticalPadding * 2,
                };
                const isForced = isSelected || isHovered;
                const overlaps = occupiedBounds.some((occupied) =>
                    doGraphLabelBoundsOverlap(occupied, bounds, 3 / globalScale),
                );
                if (overlaps && !isForced) {
                    continue;
                }

                occupiedBounds.push(bounds);
                ctx.save();
                ctx.globalAlpha = isDimmed && !isHovered ? GRAPH_DIMMED_LABEL_OPACITY : 1;
                ctx.fillStyle = palette.labelBackground;
                ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
                ctx.fillStyle = palette.labelText;
                ctx.fillText(label, x, y + verticalPadding);
                ctx.restore();
            }
        },
        [hoveredNodeId, labelPriorityNodes, nodeById, theme],
    );

    const linkCanvasObject = useCallback(
        (link: CanvasLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const selectedId = selectedNodeIdRef.current;
            const focusedId = focusedClusterIdRef.current;
            const sourceId = getEndpointId(link.source);
            const targetId = getEndpointId(link.target);
            const sourceNode = getEndpointNode(link.source);
            const targetNode = getEndpointNode(link.target);

            if (!sourceNode || !targetNode) {
                return;
            }

            const isConnected = selectedId !== null && (sourceId === selectedId || targetId === selectedId);
            const isOutsideFocusedCluster =
                focusedId !== null &&
                (clusterByNodeIdRef.current.get(sourceId) !== focusedId ||
                    clusterByNodeIdRef.current.get(targetId) !== focusedId);
            const isDimmed = isOutsideFocusedCluster || (selectedId !== null && !isConnected);

            ctx.beginPath();
            ctx.moveTo(sourceNode.x ?? 0, sourceNode.y ?? 0);
            ctx.lineTo(targetNode.x ?? 0, targetNode.y ?? 0);
            ctx.strokeStyle = getGraphLinkColor(theme, { isConnected, isDimmed });
            ctx.lineWidth = (isConnected ? 2 : 0.65) / globalScale;
            ctx.stroke();
        },
        [theme],
    );

    return (
        <div
            ref={containerRef}
            className="surface-base graph-canvas relative h-[clamp(36rem,calc(100dvh-8rem),72rem)] w-full max-w-full overflow-hidden"
            style={{ '--graph-bg': graphTheme.background } as React.CSSProperties}
        >
            <div className="surface-floating absolute top-3 right-3 z-20 flex items-center">
                <button
                    type="button"
                    onClick={() => zoomGraph(0.8)}
                    className="focus-ring-soft inline-flex h-10 w-10 items-center justify-center text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                    aria-label="Zoom out"
                >
                    <Icon.ZoomOut className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    onClick={fitGraph}
                    className="focus-ring-soft inline-flex h-10 w-10 items-center justify-center text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                    aria-label="Fit connection map"
                >
                    <Icon.Crosshair className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    onClick={() => zoomGraph(1.25)}
                    className="focus-ring-soft inline-flex h-10 w-10 items-center justify-center text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                    aria-label="Zoom in"
                >
                    <Icon.ZoomIn className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>
            <div aria-hidden="true">
                <ForceGraph2D<GraphVisualNode, object>
                    ref={graphRef}
                    graphData={graphData}
                    width={dimensions.width}
                    height={dimensions.height}
                    nodeId="id"
                    nodeLabel=""
                    nodeCanvasObject={nodeCanvasObject}
                    nodePointerAreaPaint={(node: CanvasNode, color, ctx) => {
                        ctx.beginPath();
                        ctx.arc(
                            node.x ?? 0,
                            node.y ?? 0,
                            Math.max(getNodeSize(node.connections) + 5, 11),
                            0,
                            2 * Math.PI,
                        );
                        ctx.fillStyle = color;
                        ctx.fill();
                    }}
                    linkCanvasObject={linkCanvasObject}
                    linkCanvasObjectMode={() => 'replace'}
                    linkDirectionalParticles={0}
                    onRenderFramePre={drawClusterRegions}
                    onRenderFramePost={drawNodeLabels}
                    onNodeClick={handleNodeClick}
                    onNodeHover={handleNodeHover}
                    onBackgroundClick={onClearFocus}
                    warmupTicks={45}
                    cooldownTicks={100}
                    d3AlphaDecay={0.045}
                    d3VelocityDecay={0.32}
                    enableZoomInteraction={(event) => event.ctrlKey || event.metaKey}
                    enablePanInteraction={true}
                    minZoom={MIN_ZOOM}
                    maxZoom={MAX_ZOOM}
                />
            </div>
        </div>
    );
}
