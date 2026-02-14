import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ForceGraph2D from 'react-force-graph-2d';

import { fetchNoteGraph, type GraphNode, type GraphLink } from '~/apis/note.api';
import { Empty, PageLayout, Skeleton } from '~/components/shared';
import { useTheme } from '~/store/theme';
import { getHash } from '~/modules/hash';

interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

interface ForceGraphInstance {
    zoomToFit: (duration?: number, padding?: number) => void;
    enableZoomInteraction: (enable: boolean) => void;
}

const PASTEL_COLORS_LIGHT = [
    '#FCEBAF', '#B2E0B2', '#FFB3C1', '#FFCCB3',
    '#A4D8E1', '#E1B7E1', '#A4DBD6', '#E1C6E7'
];

const PASTEL_COLORS_DARK = [
    '#5c5540', '#3d5c3d', '#5c3d44', '#5c4d40',
    '#3d4f5c', '#5c3d5c', '#3d5c56', '#4f3d5c'
];

const PASTEL_COLORS_LIGHT_DIM = PASTEL_COLORS_LIGHT.map(c => hexToRgba(c, 0.15));
const PASTEL_COLORS_DARK_DIM = PASTEL_COLORS_DARK.map(c => hexToRgba(c, 0.15));

function hexToRgba(hex: string, alpha: number) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function getNodeSize(connections: number) {
    if (connections <= 1) return 3;
    if (connections <= 3) return 4;
    if (connections <= 5) return 5;
    return Math.min(8, 5 + Math.sqrt(connections) * 0.8);
}

export default function Graph() {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<ForceGraphInstance | null>(null);
    const [dimensions, setDimensions] = useState({
        width: 800,
        height: 600
    });

    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    const { theme } = useTheme(state => state);
    const isDark = theme === 'dark';
    const isDarkRef = useRef(isDark);
    isDarkRef.current = isDark;

    const { data, isLoading, error } = useQuery({
        queryKey: ['noteGraph'],
        async queryFn() {
            const response = await fetchNoteGraph();
            if (response.type === 'success') {
                return response.noteGraph;
            }
            throw new Error('Failed to fetch graph data');
        }
    });

    useEffect(() => {
        if (!data) return;

        const updateDimensions = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setDimensions({
                    width: rect.width,
                    height: Math.max(600, window.innerHeight - 150)
                });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, [data]);

    useEffect(() => {
        if (data && graphRef.current) {
            setTimeout(() => {
                graphRef.current?.zoomToFit(400, 50);
            }, 500);
        }
    }, [data]);

    const selectedNodeIdRef = useRef(selectedNodeId);
    selectedNodeIdRef.current = selectedNodeId;

    const handleNodeClick = useCallback((node: GraphNode) => {
        if (selectedNodeIdRef.current === node.id) {
            navigate(`/${node.id}`);
        } else {
            setSelectedNodeId(node.id);
        }
    }, [navigate]);

    const handleBackgroundClick = useCallback(() => {
        setSelectedNodeId(null);
    }, []);

    const handleNodeHover = useCallback((_node: GraphNode | null) => {
        if (containerRef.current) {
            containerRef.current.style.cursor = _node ? 'pointer' : 'default';
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

    const graphData: GraphData | null = useMemo(() => {
        if (!data || data.nodes.length === 0) return null;
        const connectedNodes = data.nodes.filter(n => n.connections > 0);
        if (connectedNodes.length === 0) return null;
        const connectedIds = new Set(connectedNodes.map(n => n.id));
        return {
            nodes: connectedNodes,
            links: data.links.filter(l => connectedIds.has(l.source) && connectedIds.has(l.target))
        };
    }, [data]);

    const adjacencyMapRef = useRef(new Map<string, Set<string>>());
    const adjacencyMap = useMemo(() => {
        const map = new Map<string, Set<string>>();
        if (graphData) {
            for (const link of graphData.links) {
                if (!map.has(link.source)) map.set(link.source, new Set());
                if (!map.has(link.target)) map.set(link.target, new Set());
                map.get(link.source)!.add(link.target);
                map.get(link.target)!.add(link.source);
            }
        }
        return map;
    }, [graphData]);
    adjacencyMapRef.current = adjacencyMap;

    const nodeCanvasObject = useCallback((node: GraphNode & { x?: number; y?: number }, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const isDark = isDarkRef.current;
        const selectedId = selectedNodeId;
        const adjacencyMap = adjacencyMapRef.current;

        const nodeSize = getNodeSize(node.connections);
        const nx = node.x || 0;
        const ny = node.y || 0;

        const isSelected = selectedId === node.id;
        const isConnected = selectedId ? adjacencyMap.get(selectedId)?.has(node.id) ?? false : false;
        const isDimmed = selectedId !== null && !isSelected && !isConnected;

        ctx.beginPath();
        ctx.arc(nx, ny, nodeSize, 0, Math.PI * 2);

        if (isDimmed) {
            if (node.connections > 3) {
                ctx.fillStyle = isDark ? 'rgba(92,61,68,0.15)' : 'rgba(255,179,193,0.15)';
            } else {
                const colors = isDark ? PASTEL_COLORS_DARK_DIM : PASTEL_COLORS_LIGHT_DIM;
                ctx.fillStyle = colors[getHash(node.id) % colors.length];
            }
            ctx.fill();
            return;
        }

        if (isSelected) {
            ctx.fillStyle = '#FFCCB3';
        } else if (isConnected) {
            ctx.fillStyle = isDark ? '#E1C6E7' : '#E1B7E1';
        } else if (node.connections > 3) {
            ctx.fillStyle = isDark ? '#5c3d44' : '#FFB3C1';
        } else {
            const colors = isDark ? PASTEL_COLORS_DARK : PASTEL_COLORS_LIGHT;
            ctx.fillStyle = colors[getHash(node.id) % colors.length];
        }
        ctx.fill();

        ctx.strokeStyle = isDark ? '#404040' : '#3d3d3d';
        ctx.lineWidth = (isSelected ? 2 : 1) / globalScale;
        ctx.stroke();

        if (isSelected) {
            ctx.beginPath();
            ctx.arc(nx, ny, nodeSize + 2 / globalScale, 0, Math.PI * 2);
            ctx.strokeStyle = isDark ? '#e4e4e7' : '#27272a';
            ctx.lineWidth = 1.5 / globalScale;
            ctx.stroke();
        }

        if (isSelected || isConnected || globalScale > 2.5) {
            const label = node.title || 'Untitled';
            const fontSize = Math.max(10 / globalScale, 2.5);
            ctx.font = `${(isSelected || isConnected) ? 'bold ' : ''}${fontSize}px Gaegu, cursive`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            const textWidth = ctx.measureText(label).width;
            const padding = 2 / globalScale;
            const labelY = ny + nodeSize + 3 / globalScale;

            ctx.fillStyle = isDark ? 'rgba(42,37,32,0.85)' : 'rgba(255,252,247,0.9)';
            ctx.fillRect(nx - textWidth / 2 - padding, labelY, textWidth + padding * 2, fontSize + padding * 2);

            ctx.fillStyle = isDark ? '#e4e4e7' : '#27272a';
            ctx.fillText(label, nx, labelY + padding);
        }
    }, [selectedNodeId]);

    const linkCanvasObject = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const isDark = isDarkRef.current;
        const selectedId = selectedNodeId;

        const source = link.source as unknown as { x?: number; y?: number; id: string };
        const target = link.target as unknown as { x?: number; y?: number; id: string };

        const isConnected = selectedId
            ? (source.id === selectedId || target.id === selectedId)
            : false;
        const isDimmed = selectedId !== null && !isConnected;

        ctx.beginPath();
        ctx.moveTo(source.x || 0, source.y || 0);
        ctx.lineTo(target.x || 0, target.y || 0);

        if (isDimmed) {
            ctx.strokeStyle = isDark ? 'rgba(82,82,91,0.06)' : 'rgba(212,212,216,0.06)';
            ctx.lineWidth = 0.5 / globalScale;
        } else if (isConnected) {
            ctx.strokeStyle = isDark ? '#E1C6E7' : '#E1B7E1';
            ctx.lineWidth = 2 / globalScale;
        } else {
            ctx.strokeStyle = isDark ? 'rgba(82,82,91,0.5)' : 'rgba(212,212,216,0.7)';
            ctx.lineWidth = 0.5 / globalScale;
        }
        ctx.stroke();
    }, [selectedNodeId]);

    if (isLoading) {
        return (
            <PageLayout title="Knowledge Graph">
                <div className="flex items-center justify-center" style={{ height: '600px' }}>
                    <Skeleton width="100%" height="100%" />
                </div>
            </PageLayout>
        );
    }

    if (error) {
        return (
            <PageLayout title="Knowledge Graph">
                <Empty
                    icon="❌"
                    title="Failed to load graph"
                    description="There was an error loading the knowledge graph."
                />
            </PageLayout>
        );
    }

    if (!graphData) {
        return (
            <PageLayout title="Knowledge Graph">
                <Empty
                    icon="🌌"
                    title="No constellations yet"
                    description="Link your notes together and watch your own starry sky unfold"
                />
            </PageLayout>
        );
    }

    return (
        <PageLayout
            title="Knowledge Graph"
            description={`${graphData.nodes.length} linked notes · ${graphData.links.length} connections`}>
            <div
                ref={containerRef}
                className="relative overflow-hidden border-2 border-border rounded-sketchy-lg shadow-sketchy"
                style={{ background: isDark ? '#2a2520' : '#fffcf7' }}>
                {selectedNodeId && (() => {
                    const node = graphData.nodes.find(n => n.id === selectedNodeId);
                    if (!node) return null;
                    return (
                        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-sketchy-md border-2 border-border bg-bg-primary shadow-sketchy text-sm">
                            <span className="font-bold truncate max-w-48">{node.title}</span>
                            <span className="text-fg-tertiary">· {node.connections} links</span>
                            <button
                                onClick={() => setSelectedNodeId(null)}
                                className="ml-1 text-fg-tertiary hover:text-fg-primary transition-colors cursor-pointer"
                                aria-label="Deselect node">
                                ✕
                            </button>
                        </div>
                    );
                })()}
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
                        ctx.arc(node.x || 0, node.y || 0, Math.max(getNodeSize(node.connections) + 4, 10), 0, 2 * Math.PI);
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
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-sketchy-xs border-2 border-border" style={{ background: isDark ? '#5c3d44' : '#FFB3C1' }} />
                    <span className="text-fg-tertiary font-medium">Hub notes (4+ connections)</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-sketchy-xs border-2 border-border" style={{ background: isDark ? '#3d5c3d' : '#B2E0B2' }} />
                    <span className="text-fg-tertiary font-medium">Connected notes</span>
                </div>
            </div>
        </PageLayout>
    );
}
