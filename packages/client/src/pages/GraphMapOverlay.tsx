import { Link } from '@tanstack/react-router';
import classNames from 'classnames';

import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';
import { ViewChip } from '~/components/view';
import { timeSince } from '~/modules/time';
import { NOTE_ROUTE } from '~/modules/url';
import { useTheme } from '~/store/theme';
import type { GraphCluster, GraphVisualNode } from './graph-data';
import { getGraphClusterColor } from './graph-theme';

const MAX_VISIBLE_CLUSTERS = 6;
const MAX_VISIBLE_MOBILE_CLUSTERS = 3;
const MAX_VISIBLE_CONNECTIONS = 4;

interface GraphMapOverlayProps {
    clusters: GraphCluster[];
    focusedClusterId: string | null;
    onClearSelection: () => void;
    onFocusCluster: (clusterId: string) => void;
    onSelectNode: (nodeId: string) => void;
    selectedConnectedNodes: GraphVisualNode[];
    selectedNode: GraphVisualNode | null;
}

function formatUpdatedAt(updatedAt: string) {
    const timestamp = Number(updatedAt);
    return Number.isFinite(timestamp) ? `Updated ${timeSince(timestamp)}` : 'Recently updated';
}

export function GraphMapOverlay({
    clusters,
    focusedClusterId,
    onClearSelection,
    onFocusCluster,
    onSelectNode,
    selectedConnectedNodes,
    selectedNode,
}: GraphMapOverlayProps) {
    const { theme } = useTheme((state) => state);
    const visibleClusters = clusters.slice(0, MAX_VISIBLE_CLUSTERS);
    const hiddenClusterCount = clusters.length - visibleClusters.length;
    const hiddenMobileClusterCount = clusters.length - Math.min(clusters.length, MAX_VISIBLE_MOBILE_CLUSTERS);
    const selectedCluster = selectedNode
        ? (clusters.find((cluster) => cluster.id === selectedNode.clusterId) ?? null)
        : null;
    const visibleConnections = selectedConnectedNodes.slice(0, MAX_VISIBLE_CONNECTIONS);
    const hiddenConnectionCount = selectedConnectedNodes.length - visibleConnections.length;

    return (
        <>
            <section
                aria-labelledby="graph-areas-heading"
                className="surface-floating absolute top-3 left-3 z-10 w-[min(17.5rem,calc(100%-4.75rem))] overflow-hidden p-2.5 max-sm:py-2"
            >
                <div className="flex items-center justify-between gap-3 px-1 pb-1.5">
                    <div className="flex min-w-0 items-center gap-2 text-fg-secondary">
                        <Icon.Diagram className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <Text id="graph-areas-heading" as="h2" variant="label" weight="semibold" truncate>
                            Connection areas
                        </Text>
                    </div>
                    <Text as="span" variant="meta" tone="tertiary" className="shrink-0 tabular-nums">
                        {clusters.length}
                    </Text>
                </div>
                <Text as="p" variant="label" tone="tertiary" className="px-1 pb-2 max-sm:hidden">
                    Links define areas · tags are signals
                </Text>
                <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto max-sm:max-h-none max-sm:flex-row max-sm:gap-1 max-sm:overflow-x-hidden">
                    {visibleClusters.map((cluster, index) => {
                        const isFocused = focusedClusterId === cluster.id;
                        const clusterColor = getGraphClusterColor(theme, cluster.colorIndex);

                        return (
                            <button
                                key={cluster.id}
                                type="button"
                                aria-pressed={isFocused}
                                onClick={() => onFocusCluster(cluster.id)}
                                className={classNames(
                                    'focus-ring-soft flex min-w-0 items-center gap-2 rounded-[10px] px-2 py-1.5 text-left outline-none transition-colors',
                                    'max-sm:shrink-0 max-sm:py-1',
                                    index >= MAX_VISIBLE_MOBILE_CLUSTERS && 'max-sm:hidden',
                                    isFocused
                                        ? 'bg-elevated text-fg-default'
                                        : 'text-fg-secondary hover:bg-hover-subtle hover:text-fg-default',
                                )}
                            >
                                <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: clusterColor }}
                                    aria-hidden="true"
                                />
                                <Text as="span" variant="meta" weight={isFocused ? 'semibold' : 'medium'} truncate>
                                    {cluster.label}
                                </Text>
                                <Text
                                    as="span"
                                    variant="label"
                                    tone="tertiary"
                                    className="ml-auto shrink-0 tabular-nums max-sm:hidden"
                                >
                                    {cluster.nodeIds.length}
                                </Text>
                            </button>
                        );
                    })}
                </div>
                {hiddenMobileClusterCount > 0 && (
                    <Text as="p" variant="label" tone="tertiary" className="px-1 pt-1 sm:hidden">
                        +{hiddenMobileClusterCount} more
                    </Text>
                )}
                {hiddenClusterCount > 0 && (
                    <Text as="p" variant="label" tone="tertiary" className="px-2 pt-1.5 max-sm:hidden">
                        +{hiddenClusterCount} more areas on the map
                    </Text>
                )}
            </section>

            <Text as="p" role="status" aria-live="polite" className="sr-only">
                {selectedNode
                    ? `${selectedNode.title || 'Untitled'} selected near ${selectedCluster?.label ?? 'the graph'}, with ${selectedConnectedNodes.length} direct connections.`
                    : focusedClusterId
                      ? `${clusters.find((cluster) => cluster.id === focusedClusterId)?.label ?? 'Connection area'} highlighted.`
                      : `${clusters.length} connection areas shown.`}
            </Text>

            {selectedNode && (
                <section
                    aria-labelledby="graph-selected-note-heading"
                    className="surface-floating absolute right-3 bottom-3 z-10 max-h-[46%] w-[min(20rem,calc(100%-1.5rem))] overflow-y-auto p-3.5"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                                <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{
                                        backgroundColor: getGraphClusterColor(theme, selectedNode.clusterColorIndex),
                                    }}
                                    aria-hidden="true"
                                />
                                <Text as="span" variant="label" weight="medium" tone="secondary" truncate>
                                    Near {selectedCluster?.label ?? selectedNode.clusterLabel}
                                </Text>
                            </div>
                            <Text
                                id="graph-selected-note-heading"
                                as="h2"
                                variant="body"
                                weight="bold"
                                className="mt-2"
                            >
                                {selectedNode.title || 'Untitled'}
                            </Text>
                            <Text as="p" variant="label" tone="tertiary" className="mt-1">
                                {selectedConnectedNodes.length}{' '}
                                {selectedConnectedNodes.length === 1 ? 'direct connection' : 'direct connections'} ·{' '}
                                {formatUpdatedAt(selectedNode.updatedAt)}
                            </Text>
                        </div>
                        <button
                            type="button"
                            onClick={onClearSelection}
                            className="focus-ring-soft inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                            aria-label="Deselect node"
                        >
                            <Icon.Close className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                    </div>

                    {selectedNode.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Selected note tags">
                            {selectedNode.tags.slice(0, 4).map((tag) => (
                                <ViewChip
                                    key={tag.id}
                                    size="compact"
                                    className="border-border-subtle bg-transparent text-fg-secondary"
                                >
                                    {tag.name}
                                </ViewChip>
                            ))}
                        </div>
                    )}

                    {visibleConnections.length > 0 && (
                        <div className="mt-3 border-t border-border-subtle/80 pt-2.5">
                            <Text as="h3" variant="label" weight="semibold" tone="tertiary" className="px-1">
                                Connected notes
                            </Text>
                            <ul className="mt-1">
                                {visibleConnections.map((node) => (
                                    <li key={node.id}>
                                        <button
                                            type="button"
                                            onClick={() => onSelectNode(node.id)}
                                            className="focus-ring-soft flex w-full min-w-0 items-center gap-2 rounded-[10px] px-2 py-1.5 text-left text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                                        >
                                            <span
                                                className="h-2 w-2 shrink-0 rounded-full"
                                                style={{
                                                    backgroundColor: getGraphClusterColor(
                                                        theme,
                                                        node.clusterColorIndex,
                                                    ),
                                                }}
                                                aria-hidden="true"
                                            />
                                            <Text as="span" variant="meta" weight="medium" truncate>
                                                {node.title || 'Untitled'}
                                            </Text>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            {hiddenConnectionCount > 0 && (
                                <Text as="p" variant="label" tone="tertiary" className="px-2 pt-1">
                                    +{hiddenConnectionCount} more connections on the map
                                </Text>
                            )}
                        </div>
                    )}

                    <Link
                        to={NOTE_ROUTE}
                        params={{ id: selectedNode.id }}
                        className="focus-ring-soft mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-[10px] border border-border-subtle bg-elevated px-3 text-sm font-semibold text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                    >
                        Open note
                        <Icon.ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </section>
            )}
        </>
    );
}
