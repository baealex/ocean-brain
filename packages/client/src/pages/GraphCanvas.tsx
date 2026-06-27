import { useCallback, useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

import type { GraphLink, GraphNode } from '~/apis/note.api';
import { Text } from '~/components/ui';
import { getHash } from '~/modules/hash';
import { useTheme } from '~/store/theme';
import { type GraphData, getNodeSize } from './graph-data';
import { getGraphLabelFont, getGraphLinkColor, getGraphNodeFill, getGraphTheme } from './graph-theme';

interface ForceGraphInstance {
    zoomToFit: (duration?: number, padding?: number) => void;
    enableZoomInteraction: (enable: boolean) => void;
}

interface GraphCanvasProps {
    adjacencyMap: Map<string, Set<string>>;
    graphData: GraphData;
    onClearSelection: () => void;
    onOpenNode: (nodeId: string) => void;
    onSelectNode: (nodeId: string) => void;
    selectedNodeId: string | null;
}

export function GraphCanvas({
    adjacencyMap,
    graphData,
    onClearSelection,
    onOpenNode,
    onSelectNode,
    selectedNodeId,
}: GraphCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<ForceGraphInstance | null>(null);
    const [dimensions, setDimensions] = useState({
        width: 800,
        height: 600,
    });

    const { theme } = useTheme((state) => state);
    const graphTheme = getGraphTheme(theme);
    const graphThemeRef = useRef(graphTheme);
    graphThemeRef.current = graphTheme;

    const selectedNodeIdRef = useRef(selectedNodeId);
    selectedNodeIdRef.current = selectedNodeId;

    const adjacencyMapRef = useRef(adjacencyMap);
    adjacencyMapRef.current = adjacencyMap;

    useEffect(() => {
        const updateDimensions = () => {
            if (!containerRef.current) {
                return;
            }

            const rect = containerRef.current.getBoundingClientRect();
            const isCompactLayout = rect.width < 768;
            setDimensions({
                width: rect.width,
                height: isCompactLayout ? Math.max(420, Math.min(520, rect.width * 1.25)) : Math.max(600, rect.height),
            });
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            graphRef.current?.zoomToFit(400, dimensions.width < 768 ? 80 : 50);
        }, 500);

        return () => window.clearTimeout(timeoutId);
    }, [dimensions.width, graphData]);

    const handleNodeClick = useCallback(
        (node: GraphNode) => {
            if (selectedNodeIdRef.current === node.id) {
                onOpenNode(node.id);
                return;
            }

            onSelectNode(node.id);
        },
        [onOpenNode, onSelectNode],
    );

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

    return (
        <div
            ref={containerRef}
            className="surface-base graph-canvas relative min-h-[420px] overflow-hidden md:min-h-[520px] xl:h-[min(44rem,calc(100vh-10rem))]"
            style={{ '--graph-bg': graphTheme.background } as React.CSSProperties}
        >
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
                    onBackgroundClick={onClearSelection}
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
    );
}
