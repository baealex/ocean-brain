// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { GraphVisualNode } from './graph-data';
import {
    clampGraphLabelCenter,
    doGraphLabelBoundsOverlap,
    getGraphAreaLabelText,
    getGraphAreaName,
    getGraphNodeFocusState,
    getGraphNodeLabelText,
    shouldShowGraphNodeLabel,
} from './graph-labels';

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
    isIsolated: false,
    x: 0,
    y: 0,
    ...overrides,
});

describe('graph zoom labels', () => {
    it.each([
        { note: 'an area hub', node: { isClusterHub: true }, globalScale: 1, expected: false },
        { note: 'an area hub', node: { isClusterHub: true }, globalScale: 2, expected: true },
        { note: 'a well-linked note', node: { connections: 9 }, globalScale: 2, expected: false },
        { note: 'a well-linked note', node: { connections: 9 }, globalScale: 3.5, expected: true },
        { note: 'a linked note', node: { connections: 3 }, globalScale: 2, expected: false },
        { note: 'a linked note', node: { connections: 3 }, globalScale: 3.5, expected: true },
        { note: 'a leaf note', node: { connections: 1 }, globalScale: 3.5, expected: false },
        { note: 'a leaf note', node: { connections: 1 }, globalScale: 5, expected: true },
    ])('labels $note at zoom $globalScale: $expected', ({ node, globalScale, expected }) => {
        expect(shouldShowGraphNodeLabel(createNode(node), { globalScale })).toBe(expected);
    });

    it.each([
        { state: 'selected', options: { isSelected: true } },
        { state: 'hovered', options: { isHovered: true } },
        { state: 'directly connected to the selection', options: { isConnected: true } },
    ])('labels a $state note even when zoomed out', ({ options }) => {
        expect(shouldShowGraphNodeLabel(createNode(), { globalScale: 0.5, ...options })).toBe(true);
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

describe('graph focus states', () => {
    const adjacency = new Map([
        ['1', new Set(['2'])],
        ['2', new Set(['1'])],
    ]);
    const baseOptions = { adjacency, focusedClusterId: null, hoveredNodeId: null, selectedNodeId: null };

    it.each([
        { note: 'any note without a selection or focused area', node: {}, options: {}, isDimmed: false },
        { note: 'the selected note', node: { id: '1' }, options: { selectedNodeId: '1' }, isDimmed: false },
        { note: 'a direct connection', node: { id: '2' }, options: { selectedNodeId: '1' }, isDimmed: false },
        { note: 'an unrelated note', node: { id: '3' }, options: { selectedNodeId: '1' }, isDimmed: true },
        {
            note: 'a note in the focused area',
            node: { clusterId: 'cluster:1' },
            options: { focusedClusterId: 'cluster:1' },
            isDimmed: false,
        },
        {
            note: 'a note outside the focused area',
            node: { clusterId: 'cluster:2' },
            options: { focusedClusterId: 'cluster:1' },
            isDimmed: true,
        },
    ])('fades $note: $isDimmed', ({ node, options, isDimmed }) => {
        expect(getGraphNodeFocusState(createNode(node), { ...baseOptions, ...options }).isDimmed).toBe(isDimmed);
    });
});

describe('graph area names', () => {
    it.each([
        { area: 'a linked area', cluster: { label: 'Graph ideas', isIsolated: false }, expected: 'Graph ideas area' },
        { area: 'unlinked notes', cluster: { label: 'Unlinked notes', isIsolated: true }, expected: 'Unlinked notes' },
    ])('names $area as $expected', ({ cluster, expected }) => {
        expect(getGraphAreaName(cluster)).toBe(expected);
    });

    it.each([
        { position: 'past the left edge', center: 10, expected: 58 },
        { position: 'inside the canvas', center: 150, expected: 150 },
        { position: 'past the right edge', center: 290, expected: 242 },
    ])('keeps a 100px area label $position within the canvas', ({ center, expected }) => {
        expect(clampGraphLabelCenter(center, 100, 8, 292)).toBe(expected);
    });

    it('labels an area on the canvas with its size so it never reads as a note title', () => {
        expect(getGraphAreaLabelText({ label: 'Graph ideas', isIsolated: false, nodeIds: ['1', '2', '3'] })).toBe(
            'Graph ideas area · 3 notes',
        );
    });
});
