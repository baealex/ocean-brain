import type { GraphVisualNode } from './graph-data';

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
    if (isSelected || isHovered) {
        return true;
    }

    if (isConnected) {
        return globalScale >= 1.8;
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

export function getGraphNodeLabelText(title: string, { globalScale, isEmphasized }: GraphNodeLabelTextOptions) {
    const normalizedTitle = title.trim() || 'Untitled';
    const characters = Array.from(normalizedTitle);
    const maxLength = isEmphasized
        ? globalScale < 3.2
            ? 32
            : 48
        : globalScale < 3.2
          ? 24
          : globalScale < 4.2
            ? 36
            : 48;

    if (characters.length <= maxLength) {
        return normalizedTitle;
    }

    return `${characters.slice(0, maxLength - 1).join('')}…`;
}

export function doGraphLabelBoundsOverlap(first: GraphLabelBounds, second: GraphLabelBounds, gap = 0) {
    return (
        first.left < second.right + gap &&
        first.right + gap > second.left &&
        first.top < second.bottom + gap &&
        first.bottom + gap > second.top
    );
}
