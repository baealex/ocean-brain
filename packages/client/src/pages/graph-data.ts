import type { GraphLink, GraphNode, NoteGraph } from '~/apis/note.api';

const COMMUNITY_RESOLUTION = 1;
const MAX_COMMUNITY_PASSES = 20;
const TARGET_MAX_CONNECTION_AREAS = 16;
const CLUSTER_SPACING = 190;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const ISOLATED_CLUSTER_ID = 'cluster:isolated';
const ISOLATED_CLUSTER_LABEL = 'Unlinked notes';

interface WeightedNeighbor {
    id: string;
    weight: number;
}

export interface GraphCluster {
    id: string;
    label: string;
    colorIndex: number;
    hubNodeId: string;
    nodeIds: string[];
    tagNames: string[];
    isIsolated: boolean;
    x: number;
    y: number;
}

export interface GraphVisualNode extends GraphNode {
    clusterId: string;
    clusterLabel: string;
    clusterColorIndex: number;
    clusterX: number;
    clusterY: number;
    isClusterHub: boolean;
    isIsolated: boolean;
    x: number;
    y: number;
}

export interface GraphData {
    nodes: GraphVisualNode[];
    isolatedNodes: GraphVisualNode[];
    links: GraphLink[];
    clusters: GraphCluster[];
}

function stableHash(value: string) {
    let hash = 2_166_136_261;

    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16_777_619);
    }

    return hash >>> 0;
}

function createWeightedAdjacency(nodes: GraphNode[], links: GraphLink[]) {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const adjacency = new Map(nodes.map((node) => [node.id, [] as WeightedNeighbor[]]));

    for (const link of links) {
        const source = nodeById.get(link.source);
        const target = nodeById.get(link.target);
        if (!source || !target || source.id === target.id) {
            continue;
        }

        adjacency.get(source.id)?.push({ id: target.id, weight: 1 });
        adjacency.get(target.id)?.push({ id: source.id, weight: 1 });
    }

    return adjacency;
}

function detectCommunities(nodes: GraphNode[], adjacency: Map<string, WeightedNeighbor[]>) {
    const sortedNodes = [...nodes].sort((a, b) => b.connections - a.connections || a.id.localeCompare(b.id));
    const communityByNodeId = new Map(nodes.map((node) => [node.id, node.id]));
    const degreeByNodeId = new Map(
        nodes.map((node) => [
            node.id,
            (adjacency.get(node.id) ?? []).reduce((sum, neighbor) => sum + neighbor.weight, 0),
        ]),
    );
    const communityWeight = new Map(degreeByNodeId);
    const totalWeight = [...degreeByNodeId.values()].reduce((sum, degree) => sum + degree, 0);

    if (totalWeight === 0) {
        return communityByNodeId;
    }

    for (let pass = 0; pass < MAX_COMMUNITY_PASSES; pass += 1) {
        let movedNodeCount = 0;

        for (const node of sortedNodes) {
            const currentCommunity = communityByNodeId.get(node.id) ?? node.id;
            const nodeDegree = degreeByNodeId.get(node.id) ?? 0;
            communityWeight.set(currentCommunity, (communityWeight.get(currentCommunity) ?? 0) - nodeDegree);

            const weightByNeighborCommunity = new Map<string, number>();
            for (const neighbor of adjacency.get(node.id) ?? []) {
                const community = communityByNodeId.get(neighbor.id) ?? neighbor.id;
                weightByNeighborCommunity.set(
                    community,
                    (weightByNeighborCommunity.get(community) ?? 0) + neighbor.weight,
                );
            }

            let bestCommunity = currentCommunity;
            let bestGain = 0;

            for (const [community, edgeWeight] of [...weightByNeighborCommunity].sort(([a], [b]) =>
                a.localeCompare(b),
            )) {
                const gain =
                    edgeWeight -
                    (COMMUNITY_RESOLUTION * ((communityWeight.get(community) ?? 0) * nodeDegree)) / totalWeight;

                if (gain > bestGain + Number.EPSILON) {
                    bestCommunity = community;
                    bestGain = gain;
                }
            }

            communityByNodeId.set(node.id, bestCommunity);
            communityWeight.set(bestCommunity, (communityWeight.get(bestCommunity) ?? 0) + nodeDegree);
            if (bestCommunity !== currentCommunity) {
                movedNodeCount += 1;
            }
        }

        if (movedNodeCount === 0) {
            break;
        }
    }

    const membersByCommunity = new Map<string, string[]>();
    for (const [nodeId, community] of communityByNodeId) {
        const members = membersByCommunity.get(community) ?? [];
        members.push(nodeId);
        membersByCommunity.set(community, members);
    }

    const normalizedCommunityByNodeId = new Map<string, string>();
    for (const members of membersByCommunity.values()) {
        const clusterId = `cluster:${[...members].sort((a, b) => a.localeCompare(b))[0]}`;
        for (const nodeId of members) {
            normalizedCommunityByNodeId.set(nodeId, clusterId);
        }
    }

    return normalizedCommunityByNodeId;
}

function getClusterTagNames(clusterNodes: GraphNode[], allNodes: GraphNode[]) {
    const globalTagCounts = new Map<string, number>();
    const tagNamesById = new Map<string, string>();

    for (const node of allNodes) {
        for (const tag of node.tags) {
            globalTagCounts.set(tag.id, (globalTagCounts.get(tag.id) ?? 0) + 1);
            tagNamesById.set(tag.id, tag.name);
        }
    }

    const clusterTagCounts = new Map<string, number>();
    for (const node of clusterNodes) {
        for (const tag of node.tags) {
            clusterTagCounts.set(tag.id, (clusterTagCounts.get(tag.id) ?? 0) + 1);
        }
    }

    return [...clusterTagCounts]
        .sort(([firstId, firstCount], [secondId, secondCount]) => {
            const firstSpecificity = firstCount / (globalTagCounts.get(firstId) ?? firstCount);
            const secondSpecificity = secondCount / (globalTagCounts.get(secondId) ?? secondCount);
            return (
                secondCount - firstCount ||
                secondSpecificity - firstSpecificity ||
                (tagNamesById.get(firstId) ?? firstId).localeCompare(tagNamesById.get(secondId) ?? secondId)
            );
        })
        .slice(0, 3)
        .map(([tagId]) => tagNamesById.get(tagId) ?? tagId);
}

function mergeGroup(
    groups: Map<string, Set<string>>,
    groupByNodeId: Map<string, string>,
    sourceId: string,
    targetId: string,
) {
    const source = groups.get(sourceId);
    const target = groups.get(targetId);
    if (!source || !target || sourceId === targetId) {
        return;
    }

    for (const nodeId of source) {
        target.add(nodeId);
        groupByNodeId.set(nodeId, targetId);
    }
    groups.delete(sourceId);
}

function findMergeCandidate(
    groups: Map<string, Set<string>>,
    groupByNodeId: Map<string, string>,
    adjacency: Map<string, WeightedNeighbor[]>,
) {
    const sortedGroups = [...groups].sort(
        ([firstId, first], [secondId, second]) => first.size - second.size || firstId.localeCompare(secondId),
    );

    for (const [sourceId, source] of sortedGroups) {
        const crossWeightByGroup = new Map<string, number>();
        for (const sourceNodeId of source) {
            for (const neighbor of adjacency.get(sourceNodeId) ?? []) {
                const targetId = groupByNodeId.get(neighbor.id);
                if (!targetId || targetId === sourceId) {
                    continue;
                }

                crossWeightByGroup.set(targetId, (crossWeightByGroup.get(targetId) ?? 0) + neighbor.weight);
            }
        }

        const target = [...crossWeightByGroup]
            .flatMap(([targetId, crossEdgeWeight]) => {
                const targetGroup = groups.get(targetId);
                return targetGroup
                    ? [
                          {
                              id: targetId,
                              size: targetGroup.size,
                              affinity: crossEdgeWeight / Math.sqrt(source.size * targetGroup.size),
                          },
                      ]
                    : [];
            })
            .sort(
                (first, second) =>
                    second.affinity - first.affinity || second.size - first.size || first.id.localeCompare(second.id),
            )[0];

        if (target) {
            return { sourceId, targetId: target.id };
        }
    }

    return null;
}

function consolidateCommunities(
    nodes: GraphNode[],
    adjacency: Map<string, WeightedNeighbor[]>,
    communityByNodeId: Map<string, string>,
) {
    const groups = new Map<string, Set<string>>();
    const groupByNodeId = new Map<string, string>();

    for (const node of nodes) {
        const communityId = communityByNodeId.get(node.id) ?? node.id;
        const group = groups.get(communityId) ?? new Set<string>();
        group.add(node.id);
        groups.set(communityId, group);
        groupByNodeId.set(node.id, communityId);
    }

    const desiredClusterCount = Math.max(
        2,
        Math.min(TARGET_MAX_CONNECTION_AREAS, Math.round(Math.sqrt(nodes.length) * 0.8)),
    );

    while (groups.size > desiredClusterCount) {
        const candidate = findMergeCandidate(groups, groupByNodeId, adjacency);
        if (!candidate) {
            break;
        }

        mergeGroup(groups, groupByNodeId, candidate.sourceId, candidate.targetId);
    }

    const consolidatedCommunityByNodeId = new Map<string, string>();
    for (const memberIds of groups.values()) {
        const sortedIds = [...memberIds].sort((a, b) => a.localeCompare(b));
        const clusterId = `cluster:${sortedIds[0]}`;
        for (const nodeId of sortedIds) {
            consolidatedCommunityByNodeId.set(nodeId, clusterId);
        }
    }

    return consolidatedCommunityByNodeId;
}

function createClusters(
    nodes: GraphNode[],
    communityByNodeId: Map<string, string>,
    adjacency: Map<string, WeightedNeighbor[]>,
) {
    const nodesByCommunity = new Map<string, GraphNode[]>();

    for (const node of nodes) {
        const community = communityByNodeId.get(node.id) ?? `cluster:${node.id}`;
        const members = nodesByCommunity.get(community) ?? [];
        members.push(node);
        nodesByCommunity.set(community, members);
    }

    return [...nodesByCommunity]
        .map(([id, members]) => {
            const memberIds = new Set(members.map((node) => node.id));
            const internalDegree = (nodeId: string) =>
                (adjacency.get(nodeId) ?? []).reduce(
                    (degree, neighbor) => degree + (memberIds.has(neighbor.id) ? neighbor.weight : 0),
                    0,
                );
            const sortedMembers = [...members].sort(
                (a, b) =>
                    internalDegree(b.id) - internalDegree(a.id) ||
                    b.connections - a.connections ||
                    b.updatedAt.localeCompare(a.updatedAt) ||
                    a.id.localeCompare(b.id),
            );
            const hubNode = sortedMembers[0];
            const tagNames = getClusterTagNames(members, nodes);

            return {
                id,
                label: hubNode.title ?? 'Untitled',
                colorIndex: stableHash(id),
                hubNodeId: hubNode.id,
                nodeIds: members.map((node) => node.id).sort((a, b) => a.localeCompare(b)),
                tagNames,
                isIsolated: false,
                x: 0,
                y: 0,
            } satisfies GraphCluster;
        })
        .sort((a, b) => b.nodeIds.length - a.nodeIds.length || a.label.localeCompare(b.label));
}

function positionClusters(clusters: GraphCluster[]) {
    return clusters.map((cluster, index) => {
        if (index === 0) {
            return cluster;
        }

        const radius = CLUSTER_SPACING * Math.sqrt(index);
        const angle = index * GOLDEN_ANGLE;
        return {
            ...cluster,
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
        };
    });
}

function createIsolatedCluster(nodes: GraphNode[], allNodes: GraphNode[]): GraphCluster {
    const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));

    return {
        id: ISOLATED_CLUSTER_ID,
        label: ISOLATED_CLUSTER_LABEL,
        colorIndex: stableHash(ISOLATED_CLUSTER_ID),
        hubNodeId: sortedNodes[0]?.id ?? ISOLATED_CLUSTER_ID,
        nodeIds: sortedNodes.map((node) => node.id),
        tagNames: getClusterTagNames(sortedNodes, allNodes),
        isIsolated: true,
        x: 0,
        y: 0,
    };
}

export function getNodeSize(connections: number) {
    if (connections <= 1) return 4;
    if (connections <= 3) return 5;
    if (connections <= 6) return 6;
    return Math.min(8.5, 6 + Math.sqrt(connections) * 0.55);
}

export function createConnectionMapData(data: NoteGraph): GraphData | null {
    const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
    const validLinks = data.links
        .filter((link) => link.source !== link.target && nodeById.has(link.source) && nodeById.has(link.target))
        .map((link) => ({ ...link }))
        .sort((a, b) => `${a.source}:${a.target}`.localeCompare(`${b.source}:${b.target}`));
    const linkedNodeIds = new Set(validLinks.flatMap((link) => [link.source, link.target]));
    const allNodes = data.nodes
        .map((node) => ({ ...node, tags: node.tags.map((tag) => ({ ...tag })) }))
        .sort((a, b) => a.id.localeCompare(b.id));

    if (allNodes.length === 0) {
        return null;
    }

    const linkedNodes = allNodes.filter((node) => linkedNodeIds.has(node.id));
    const isolatedNodes = allNodes.filter((node) => !linkedNodeIds.has(node.id));
    const adjacency = createWeightedAdjacency(linkedNodes, validLinks);
    const communities =
        linkedNodes.length > 0
            ? consolidateCommunities(linkedNodes, adjacency, detectCommunities(linkedNodes, adjacency))
            : new Map<string, string>();
    const connectedClusters = linkedNodes.length > 0 ? createClusters(linkedNodes, communities, adjacency) : [];
    const clusters = positionClusters(connectedClusters);
    const isolatedCluster = isolatedNodes.length > 0 ? createIsolatedCluster(isolatedNodes, allNodes) : null;
    const layoutClusters = isolatedCluster ? [...clusters, isolatedCluster] : clusters;
    const clusterById = new Map(layoutClusters.map((cluster) => [cluster.id, cluster]));
    const nodeIndexByCluster = new Map<string, number>();

    const nodes = allNodes
        .map((node) => {
            const isIsolated = !linkedNodeIds.has(node.id);
            const clusterId = isIsolated ? ISOLATED_CLUSTER_ID : communities.get(node.id);
            const cluster = clusterId ? clusterById.get(clusterId) : undefined;
            if (!cluster) {
                return null;
            }
            const clusterNodeIndex = nodeIndexByCluster.get(cluster.id) ?? 0;
            nodeIndexByCluster.set(cluster.id, clusterNodeIndex + 1);

            const nodeAngle = (stableHash(node.id) / 0xffff_ffff) * Math.PI * 2;
            const nodeRadius = 12 + Math.sqrt(clusterNodeIndex) * 11;

            return {
                ...node,
                clusterId: cluster.id,
                clusterLabel: cluster.label,
                clusterColorIndex: cluster.colorIndex,
                clusterX: cluster.x,
                clusterY: cluster.y,
                isClusterHub: cluster.hubNodeId === node.id,
                isIsolated,
                x: isIsolated ? cluster.x : cluster.x + Math.cos(nodeAngle) * nodeRadius,
                y: isIsolated ? cluster.y : cluster.y + Math.sin(nodeAngle) * nodeRadius,
            } satisfies GraphVisualNode;
        })
        .filter((node): node is GraphVisualNode => node !== null);

    const visibleNodes = nodes.filter((node) => !node.isIsolated);
    const hiddenIsolatedNodes = nodes.filter((node) => node.isIsolated);

    return {
        nodes: visibleNodes,
        isolatedNodes: hiddenIsolatedNodes,
        links: validLinks,
        clusters,
    };
}

export const createConnectedGraphData = createConnectionMapData;

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

export function sortGraphNodes<T extends GraphNode>(nodes: T[]) {
    return [...nodes].sort((a, b) => b.connections - a.connections || a.title.localeCompare(b.title));
}

export function filterGraphNodes<T extends GraphNode>(nodes: T[], query: string) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return nodes;
    }

    return nodes.filter((node) => node.title.toLowerCase().includes(normalizedQuery));
}

export function getSelectedGraphNode<T extends GraphNode>(nodes: T[], selectedNodeId: string | null) {
    if (!selectedNodeId) {
        return null;
    }

    return nodes.find((node) => node.id === selectedNodeId) ?? null;
}

export function getConnectedGraphNodes<T extends GraphNode>(
    nodes: T[],
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
