import { Link } from '@tanstack/react-router';
import classNames from 'classnames';
import { useState } from 'react';

import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';
import { NOTE_ROUTE } from '~/modules/url';
import { useTheme } from '~/store/theme';
import { GraphConnectedNodeList } from './GraphConnectedNodeList';
import type { GraphCluster, GraphVisualNode } from './graph-data';
import { getGraphClusterColor } from './graph-theme';

interface GraphCanvasControlsProps {
    clusters: GraphCluster[];
    focusedClusterId: string | null;
    hubConnectedNodes: GraphVisualNode[];
    hubNode: GraphVisualNode | null;
    onClearSelection: () => void;
    onFocusCluster: (clusterId: string) => void;
    onSelectNode: (nodeId: string) => void;
    selectedConnectedNodes: GraphVisualNode[];
    selectedNode: GraphVisualNode | null;
}

function formatConnectionCount(count: number) {
    return `${count} ${count === 1 ? 'connection' : 'connections'}`;
}

export function GraphCanvasControls({
    clusters,
    focusedClusterId,
    hubConnectedNodes,
    hubNode,
    onClearSelection,
    onFocusCluster,
    onSelectNode,
    selectedConnectedNodes,
    selectedNode,
}: GraphCanvasControlsProps) {
    const { theme } = useTheme((state) => state);
    const [isAreaPickerOpen, setIsAreaPickerOpen] = useState(false);
    const selectedCluster = selectedNode
        ? (clusters.find((cluster) => cluster.id === selectedNode.clusterId) ?? null)
        : null;

    return (
        <div className="space-y-3">
            <section
                aria-labelledby="graph-controls-heading"
                className="surface-base overflow-hidden rounded-[16px] border border-border-subtle/80"
            >
                <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="flex min-w-0 items-start gap-2.5">
                        <Icon.Graph className="mt-0.5 h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden="true" />
                        <div className="min-w-0">
                            <Text id="graph-controls-heading" as="h2" variant="subheading" weight="semibold">
                                Explore graph
                            </Text>
                            <Text as="p" variant="label" tone="tertiary" className="mt-1">
                                Choose an area or follow a connected note.
                            </Text>
                        </div>
                    </div>
                    {clusters.length > 1 && (
                        <button
                            type="button"
                            aria-expanded={isAreaPickerOpen}
                            aria-controls="graph-connection-areas"
                            onClick={() => setIsAreaPickerOpen((open) => !open)}
                            className="focus-ring-soft inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-border-subtle bg-elevated px-3 text-sm font-semibold text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                        >
                            <Icon.Diagram className="h-4 w-4" aria-hidden="true" />
                            Explore areas
                            <Text as="span" variant="label" tone="tertiary" className="tabular-nums">
                                {clusters.length}
                            </Text>
                            {isAreaPickerOpen ? (
                                <Icon.ChevronUp className="h-4 w-4" aria-hidden="true" />
                            ) : (
                                <Icon.ChevronDown className="h-4 w-4" aria-hidden="true" />
                            )}
                        </button>
                    )}
                </div>

                {isAreaPickerOpen && (
                    <div id="graph-connection-areas" className="border-t border-border-subtle/80 px-4 py-3 sm:px-5">
                        <Text as="p" variant="label" tone="tertiary">
                            Every area is selectable. Selecting one highlights its notes on the map.
                        </Text>
                        <ul
                            className="mt-2 max-h-52 overflow-y-auto overscroll-contain rounded-[10px] border border-border-subtle/70 divide-y divide-border-subtle/70"
                            aria-label="Connection areas"
                        >
                            {clusters.map((cluster) => {
                                const isFocused = focusedClusterId === cluster.id;
                                const clusterColor = getGraphClusterColor(theme, cluster.colorIndex);

                                return (
                                    <li key={cluster.id}>
                                        <button
                                            type="button"
                                            aria-pressed={isFocused}
                                            onClick={() => onFocusCluster(cluster.id)}
                                            className={classNames(
                                                'focus-ring-soft flex w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left outline-none transition-colors',
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
                                            <Text
                                                as="span"
                                                variant="meta"
                                                weight={isFocused ? 'semibold' : 'medium'}
                                                truncate
                                            >
                                                {cluster.label}
                                            </Text>
                                            <Text
                                                as="span"
                                                variant="label"
                                                tone="tertiary"
                                                className="ml-auto shrink-0 tabular-nums"
                                            >
                                                {cluster.nodeIds.length} notes
                                            </Text>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </section>

            {selectedNode ? (
                <section
                    aria-labelledby="graph-selected-note-heading"
                    className="surface-base overflow-hidden rounded-[16px] border border-border-subtle/80 px-4 py-3 sm:px-5"
                >
                    <div className="flex min-w-0 items-start gap-3">
                        <span
                            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                                backgroundColor: getGraphClusterColor(theme, selectedNode.clusterColorIndex),
                            }}
                            aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <Text id="graph-selected-note-heading" as="h2" variant="body" weight="bold" truncate>
                                    {selectedNode.title || 'Untitled'}
                                </Text>
                                <Text as="span" variant="label" tone="tertiary" truncate>
                                    {selectedCluster?.label ?? selectedNode.clusterLabel}
                                </Text>
                                <Text as="span" variant="label" tone="tertiary" className="tabular-nums">
                                    {formatConnectionCount(selectedConnectedNodes.length)}
                                </Text>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                            <Link
                                to={NOTE_ROUTE}
                                params={{ id: selectedNode.id }}
                                className="focus-ring-soft inline-flex h-8 items-center rounded-[9px] px-2 text-xs font-semibold text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                            >
                                Open note
                            </Link>
                            <button
                                type="button"
                                onClick={onClearSelection}
                                className="focus-ring-soft inline-flex h-8 w-8 items-center justify-center rounded-[9px] text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                                aria-label="Deselect node"
                            >
                                <Icon.Close className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                    {selectedConnectedNodes.length > 0 ? (
                        <div className="mt-3 border-t border-border-subtle/80 pt-3">
                            <Text as="h4" variant="label" weight="semibold" tone="tertiary">
                                Follow connected notes
                            </Text>
                            <GraphConnectedNodeList
                                className="mt-1"
                                nodes={selectedConnectedNodes}
                                onSelectNode={onSelectNode}
                            />
                        </div>
                    ) : (
                        <Text as="p" variant="label" tone="tertiary" className="mt-2">
                            No connected notes yet.
                        </Text>
                    )}
                </section>
            ) : (
                hubNode && (
                    <section
                        aria-labelledby="graph-starting-point-heading"
                        className="surface-base overflow-hidden rounded-[16px] border border-border-subtle/80 px-4 py-3 sm:px-5"
                    >
                        <div className="flex min-w-0 items-start gap-3">
                            <Icon.Graph className="mt-1 h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <Text
                                        id="graph-starting-point-heading"
                                        as="h2"
                                        variant="body"
                                        weight="bold"
                                        truncate
                                    >
                                        Start with {hubNode.title || 'Untitled'}
                                    </Text>
                                    <Text as="span" variant="label" tone="tertiary">
                                        {formatConnectionCount(hubNode.connections)}
                                    </Text>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => onSelectNode(hubNode.id)}
                                className="focus-ring-soft inline-flex h-8 shrink-0 items-center rounded-[9px] border border-border-subtle bg-elevated px-2.5 text-xs font-semibold text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                            >
                                Select
                            </button>
                        </div>
                        {hubConnectedNodes.length > 0 && (
                            <div className="mt-3 border-t border-border-subtle/80 pt-3">
                                <Text as="h4" variant="label" weight="semibold" tone="tertiary">
                                    Continue with a connected note
                                </Text>
                                <GraphConnectedNodeList
                                    className="mt-1"
                                    nodes={hubConnectedNodes}
                                    onSelectNode={onSelectNode}
                                />
                            </div>
                        )}
                    </section>
                )
            )}

            <Text as="p" role="status" aria-live="polite" className="sr-only">
                {selectedNode
                    ? `${selectedNode.title || 'Untitled'} selected near ${selectedCluster?.label ?? selectedNode.clusterLabel ?? 'the graph'}, with ${selectedConnectedNodes.length} direct connections.`
                    : focusedClusterId
                      ? `${clusters.find((cluster) => cluster.id === focusedClusterId)?.label ?? 'Connection area'} highlighted.`
                      : `${clusters.length} connection areas available.`}
            </Text>
        </div>
    );
}
