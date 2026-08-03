// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { GraphVisualNode } from './graph-data';
import { doGraphLabelBoundsOverlap, getGraphNodeLabelText, shouldShowGraphNodeLabel } from './graph-labels';

const createNode = (overrides: Partial<GraphVisualNode> = {}): GraphVisualNode => ({
    id: '1',
    title: 'A connected thought',
    connections: 1,
    updatedAt: '1',
    tags: [],
    clusterId: 'cluster:1',
    clusterLabel: 'A connected thought',
    clusterColorIndex: 0,
    clusterX: 0,
    clusterY: 0,
    isClusterHub: false,
    x: 0,
    y: 0,
    ...overrides,
});

describe('graph zoom labels', () => {
    it('reveals labels progressively as the user zooms in', () => {
        const hub = createNode({ isClusterHub: true });
        const important = createNode({ connections: 9 });
        const connected = createNode({ connections: 3 });
        const leaf = createNode({ connections: 1 });

        expect(shouldShowGraphNodeLabel(hub, { globalScale: 1 })).toBe(false);
        expect(shouldShowGraphNodeLabel(hub, { globalScale: 2 })).toBe(true);
        expect(shouldShowGraphNodeLabel(important, { globalScale: 2 })).toBe(false);
        expect(shouldShowGraphNodeLabel(important, { globalScale: 3.5 })).toBe(true);
        expect(shouldShowGraphNodeLabel(connected, { globalScale: 2 })).toBe(false);
        expect(shouldShowGraphNodeLabel(connected, { globalScale: 3.5 })).toBe(true);
        expect(shouldShowGraphNodeLabel(leaf, { globalScale: 3.5 })).toBe(false);
        expect(shouldShowGraphNodeLabel(leaf, { globalScale: 5 })).toBe(true);
    });

    it('always exposes the selected or hovered note and gradually exposes direct connections', () => {
        const node = createNode();

        expect(shouldShowGraphNodeLabel(node, { globalScale: 0.5, isSelected: true })).toBe(true);
        expect(shouldShowGraphNodeLabel(node, { globalScale: 0.5, isHovered: true })).toBe(true);
        expect(shouldShowGraphNodeLabel(node, { globalScale: 1, isConnected: true })).toBe(false);
        expect(shouldShowGraphNodeLabel(node, { globalScale: 2, isConnected: true })).toBe(true);
    });

    it('shortens long canvas labels without breaking unicode characters', () => {
        const title = '🌊'.repeat(30);
        const label = getGraphNodeLabelText(title, { globalScale: 2.5, isEmphasized: false });

        expect(label.endsWith('…')).toBe(true);
        expect(Array.from(label.slice(0, -1)).every((character) => character === '🌊')).toBe(true);
        expect(Array.from(label).length).toBeLessThan(30);
        expect(getGraphNodeLabelText('', { globalScale: 5, isEmphasized: false })).toBe('Untitled');
    });

    it('detects label collisions with a scale-aware gap', () => {
        const first = { left: 0, top: 0, right: 20, bottom: 10 };

        expect(doGraphLabelBoundsOverlap(first, { left: 18, top: 2, right: 30, bottom: 8 }, 0)).toBe(true);
        expect(doGraphLabelBoundsOverlap(first, { left: 22, top: 0, right: 30, bottom: 10 }, 1)).toBe(false);
        expect(doGraphLabelBoundsOverlap(first, { left: 22, top: 0, right: 30, bottom: 10 }, 3)).toBe(true);
    });
});
