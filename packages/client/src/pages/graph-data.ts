import type { GraphLink, GraphNode, NoteGraph } from '~/apis/note.api';

export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

export function getNodeSize(connections: number) {
    if (connections <= 1) return 3.5;
    if (connections <= 3) return 4.5;
    if (connections <= 6) return 5.5;
    return Math.min(7, 5.5 + Math.sqrt(connections) * 0.5);
}

export function createConnectedGraphData(data: NoteGraph): GraphData | null {
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
}

export function createAdjacencyMap(links: GraphLink[]) {
    const map = new Map<string, Set<string>>();

    for (const link of links) {
        if (!map.has(link.source)) map.set(link.source, new Set());
        if (!map.has(link.target)) map.set(link.target, new Set());
        map.get(link.source)?.add(link.target);
        map.get(link.target)?.add(link.source);
    }

    return map;
}

export function sortGraphNodes(nodes: GraphNode[]) {
    return [...nodes].sort((a, b) => b.connections - a.connections || a.title.localeCompare(b.title));
}

export function filterGraphNodes(nodes: GraphNode[], query: string) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return nodes;
    }

    return nodes.filter((node) => node.title.toLowerCase().includes(normalizedQuery));
}

export function getSelectedGraphNode(nodes: GraphNode[], selectedNodeId: string | null) {
    if (!selectedNodeId) {
        return null;
    }

    return nodes.find((node) => node.id === selectedNodeId) ?? null;
}

export function getConnectedGraphNodes(
    nodes: GraphNode[],
    adjacencyMap: Map<string, Set<string>>,
    selectedNodeId: string | null,
) {
    if (!selectedNodeId) {
        return [];
    }

    const connectedIds = adjacencyMap.get(selectedNodeId);
    if (!connectedIds) {
        return [];
    }

    return nodes.filter((node) => connectedIds.has(node.id));
}
