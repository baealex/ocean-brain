// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { NoteGraph } from '~/apis/note.api';
import { createConnectionMapData } from './graph-data';

const graph: NoteGraph = {
    nodes: [
        {
            id: '1',
            title: 'Product direction',
            connections: 1,
            updatedAt: '1785600000000',
            tags: [{ id: 'tag-product', name: '@product' }],
        },
        {
            id: '2',
            title: 'Graph ideas',
            connections: 2,
            updatedAt: '1785600001000',
            tags: [{ id: 'tag-product', name: '@product' }],
        },
        {
            id: '3',
            title: 'Search notes',
            connections: 2,
            updatedAt: '1785600002000',
            tags: [{ id: 'tag-product', name: '@product' }],
        },
        {
            id: '4',
            title: 'Reading queue',
            connections: 2,
            updatedAt: '1785600003000',
            tags: [{ id: 'tag-reading', name: '@reading' }],
        },
        {
            id: '5',
            title: 'Book notes',
            connections: 1,
            updatedAt: '1785600004000',
            tags: [{ id: 'tag-reading', name: '@reading' }],
        },
        {
            id: '6',
            title: 'Unlinked scratch',
            connections: 0,
            updatedAt: '1785600005000',
            tags: [{ id: 'tag-scratch', name: '@scratch' }],
        },
    ],
    links: [
        { source: '1', target: '2' },
        { source: '2', target: '3' },
        { source: '3', target: '4' },
        { source: '4', target: '5' },
    ],
};

describe('createConnectionMapData', () => {
    it('names connection areas after their hub notes and keeps tags as secondary signals', () => {
        const result = createConnectionMapData(graph);

        expect(result).not.toBeNull();
        expect(result?.nodes.map((node) => node.id)).toEqual(['1', '2', '3', '4', '5']);
        expect(result?.isolatedNodes.map((node) => node.id)).toEqual(['6']);
        expect(result?.clusters.map((cluster) => cluster.label)).toEqual(['Graph ideas', 'Reading queue']);
        expect(result?.clusters.map((cluster) => cluster.tagNames)).toEqual([['@product'], ['@reading']]);
        expect(result?.isolatedNodes[0]).toMatchObject({
            id: '6',
            clusterId: 'cluster:isolated',
            clusterLabel: 'Unlinked notes',
            isIsolated: true,
        });

        const clusterByNodeId = new Map(result?.nodes.map((node) => [node.id, node.clusterId]));
        expect(clusterByNodeId.get('1')).toBe(clusterByNodeId.get('2'));
        expect(clusterByNodeId.get('2')).toBe(clusterByNodeId.get('3'));
        expect(clusterByNodeId.get('4')).toBe(clusterByNodeId.get('5'));
        expect(clusterByNodeId.get('3')).not.toBe(clusterByNodeId.get('4'));
    });

    it('does not change connection-area membership when note tags change', () => {
        const tagged = createConnectionMapData(graph);
        const retagged = createConnectionMapData({
            ...graph,
            nodes: graph.nodes.map((node, index) => ({
                ...node,
                tags: [{ id: `unrelated-${index}`, name: `@unrelated-${index}` }],
            })),
        });

        const membership = (data: NonNullable<typeof tagged>) =>
            Object.fromEntries(data.nodes.map((node) => [node.id, node.clusterId]));

        expect(tagged).not.toBeNull();
        expect(retagged).not.toBeNull();
        expect(membership(tagged!)).toEqual(membership(retagged!));
    });

    it('keeps cluster anchors stable when API node order changes', () => {
        const first = createConnectionMapData(graph);
        const reordered = createConnectionMapData({
            nodes: [...graph.nodes].reverse(),
            links: [...graph.links].reverse(),
        });

        const anchors = (data: NonNullable<typeof first>) =>
            Object.fromEntries(data.nodes.map((node) => [node.id, [node.clusterX, node.clusterY]]));

        expect(first).not.toBeNull();
        expect(reordered).not.toBeNull();
        expect(anchors(first!)).toEqual(anchors(reordered!));
    });

    it('uses the central note title when a community has no tags', () => {
        const result = createConnectionMapData({
            nodes: [
                { id: '1', title: 'Central idea', connections: 2, updatedAt: '1', tags: [] },
                { id: '2', title: 'Branch A', connections: 1, updatedAt: '1', tags: [] },
                { id: '3', title: 'Branch B', connections: 1, updatedAt: '1', tags: [] },
            ],
            links: [
                { source: '1', target: '2' },
                { source: '1', target: '3' },
            ],
        });

        expect(result?.clusters).toHaveLength(1);
        expect(result?.clusters[0]).toMatchObject({
            label: 'Central idea',
            hubNodeId: '1',
            tagNames: [],
        });
    });

    it('never merges disconnected components just to satisfy the visual area target', () => {
        const pairCount = 20;
        const nodes = Array.from({ length: pairCount * 2 }, (_, index) => ({
            id: String(index + 1),
            title: `Note ${index + 1}`,
            connections: 1,
            updatedAt: String(1_785_600_000_000 + index),
            tags: [{ id: `tag-${Math.floor(index / 2)}`, name: `@interest-${Math.floor(index / 2)}` }],
        }));
        const links = Array.from({ length: pairCount }, (_, index) => ({
            source: String(index * 2 + 1),
            target: String(index * 2 + 2),
        }));

        const result = createConnectionMapData({ nodes, links });

        expect(result?.nodes).toHaveLength(pairCount * 2);
        expect(result?.clusters).toHaveLength(pairCount);
    });

    it('keeps a note-only graph discoverable when no references exist', () => {
        const result = createConnectionMapData({
            nodes: [
                { id: '1', title: 'First thought', connections: 0, updatedAt: '1', tags: [] },
                { id: '2', title: 'Second thought', connections: 0, updatedAt: '2', tags: [] },
            ],
            links: [],
        });

        expect(result?.nodes).toEqual([]);
        expect(result?.isolatedNodes.map((node) => node.id)).toEqual(['1', '2']);
        expect(result?.links).toEqual([]);
        expect(result?.clusters).toEqual([]);
    });
});
