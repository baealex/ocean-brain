import type { GraphCluster, GraphVisualNode } from './graph-data';

const MAX_AREA_LABEL_TITLE_LENGTH = 28;
// Labels of faded notes stay readable for orientation without competing with the active selection or area.
export const GRAPH_DIMMED_LABEL_OPACITY = 0.45;

interface GraphNodeLabelVisibilityOptions {
    globalScale: number;
    isConnected?: boolean;
    isHovered?: boolean;
    isSelected?: boolean;
}

interface GraphNodeLabelTextOptions {
    globalScale: number;
    isEmphasized: boolean;
}

interface GraphNodeFocusOptions {
    adjacency: Map<string, Set<string>>;
    focusedClusterId: string | null;
    hoveredNodeId: string | null;
    selectedNodeId: string | null;
}

export interface GraphLabelBounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export function shouldShowGraphNodeLabel(
    node: GraphVisualNode,
    { globalScale, isConnected = false, isHovered = false, isSelected = false }: GraphNodeLabelVisibilityOptions,
) {
    // Direct connections are what a selection is about; label collisions decide how many fit.
    if (isSelected || isHovered || isConnected) {
        return true;
    }

    if (node.isClusterHub) {
        return globalScale >= 1.6;
    }

    if (globalScale >= 4.2) {
        return true;
    }

    if (globalScale >= 3.2) {
        return node.connections >= 3;
    }

    return globalScale >= 2.4 && node.connections >= 8;
}

export function getGraphNodeFocusState(
    node: Pick<GraphVisualNode, 'id' | 'clusterId'>,
    { adjacency, focusedClusterId, hoveredNodeId, selectedNodeId }: GraphNodeFocusOptions,
) {
    const isSelected = selectedNodeId === node.id;
    const isHovered = hoveredNodeId === node.id;
    const isConnected = selectedNodeId ? (adjacency.get(selectedNodeId)?.has(node.id) ?? false) : false;
    const isOutsideFocusedArea = focusedClusterId !== null && focusedClusterId !== node.clusterId;
    const isDimmed = isOutsideFocusedArea || (selectedNodeId !== null && !isSelected && !isConnected);

    return { isSelected, isHovered, isConnected, isDimmed };
}

function truncateLabel(text: string, maxLength: number) {
    const characters = Array.from(text);
    return characters.length <= maxLength ? text : `${characters.slice(0, maxLength - 1).join('')}…`;
}

// Areas are named after their hub note, so the suffix keeps an area from reading as that note.
export function getGraphAreaName(cluster: Pick<GraphCluster, 'label' | 'isIsolated'>) {
    return cluster.isIsolated ? cluster.label : `${cluster.label} area`;
}

export function getGraphAreaLabelText(cluster: Pick<GraphCluster, 'label' | 'isIsolated' | 'nodeIds'>) {
    const name = getGraphAreaName({
        ...cluster,
        label: truncateLabel(cluster.label.trim() || 'Untitled', MAX_AREA_LABEL_TITLE_LENGTH),
    });
    const noteCount = cluster.nodeIds.length;
    return `${name} · ${noteCount} ${noteCount === 1 ? 'note' : 'notes'}`;
}

// Keeps a label inside the visible span so it never clips at the canvas edge; centers it when it cannot fit.
export function clampGraphLabelCenter(center: number, labelWidth: number, start: number, end: number) {
    if (end - start <= labelWidth) {
        return (start + end) / 2;
    }

    return Math.min(end - labelWidth / 2, Math.max(start + labelWidth / 2, center));
}

export function getGraphNodeLabelText(title: string, { globalScale, isEmphasized }: GraphNodeLabelTextOptions) {
    const normalizedTitle = title.trim() || 'Untitled';
    const maxLength = isEmphasized
        ? globalScale < 3.2
            ? 32
            : 48
        : globalScale < 3.2
          ? 24
          : globalScale < 4.2
            ? 36
            : 48;

    return truncateLabel(normalizedTitle, maxLength);
}

export function doGraphLabelBoundsOverlap(first: GraphLabelBounds, second: GraphLabelBounds, gap = 0) {
    return (
        first.left < second.right + gap &&
        first.right + gap > second.left &&
        first.top < second.bottom + gap &&
        first.bottom + gap > second.top
    );
}
