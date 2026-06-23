import { Link } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import classNames from 'classnames';
import { useEffect, useRef } from 'react';

import type { GraphNode } from '~/apis/note.api';
import * as Icon from '~/components/icon';
import { Input, Text } from '~/components/ui';
import { NOTE_ROUTE } from '~/modules/url';

const GRAPH_NODE_ROW_ESTIMATED_SIZE = 57;

interface GraphExplorerPanelProps {
    filteredGraphNodes: GraphNode[];
    graphNodes: GraphNode[];
    nodeSearchQuery: string;
    onClearSelection: () => void;
    onNodeSearchQueryChange: (query: string) => void;
    onSelectNode: (nodeId: string) => void;
    selectedConnectedNodes: GraphNode[];
    selectedNode: GraphNode | null;
    selectedNodeId: string | null;
}

export function GraphExplorerPanel({
    filteredGraphNodes,
    graphNodes,
    nodeSearchQuery,
    onClearSelection,
    onNodeSearchQueryChange,
    onSelectNode,
    selectedConnectedNodes,
    selectedNode,
    selectedNodeId,
}: GraphExplorerPanelProps) {
    const nodeListRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
        count: filteredGraphNodes.length,
        estimateSize: () => GRAPH_NODE_ROW_ESTIMATED_SIZE,
        getItemKey: (index) => filteredGraphNodes[index]?.id ?? index,
        getScrollElement: () => nodeListRef.current,
        initialRect: { width: 360, height: 480 },
        overscan: 8,
    });

    const visibleSelectedConnections = selectedConnectedNodes.slice(0, 4);
    const remainingSelectedConnectionCount = selectedConnectedNodes.length - visibleSelectedConnections.length;
    const selectedNodeStatus = selectedNode
        ? `${selectedNode.title || 'Untitled'} selected, ${selectedNode.connections} links`
        : 'No graph node selected';
    const virtualRows = rowVirtualizer.getVirtualItems();

    useEffect(() => {
        if (!selectedNodeId) {
            return;
        }

        const selectedIndex = filteredGraphNodes.findIndex((node) => node.id === selectedNodeId);
        if (selectedIndex < 0) {
            return;
        }

        const prefersReducedMotion =
            typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        rowVirtualizer.scrollToIndex(selectedIndex, {
            align: 'auto',
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
        });
    }, [filteredGraphNodes, rowVirtualizer, selectedNodeId]);

    return (
        <section
            className="surface-base flex min-h-[420px] flex-col overflow-hidden md:min-h-[520px] xl:h-[min(44rem,calc(100vh-10rem))]"
            aria-labelledby="graph-explorer-heading"
        >
            <div className="border-b border-border-subtle/80 px-4 py-3.5">
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-border-subtle bg-muted text-fg-secondary">
                        <Icon.Graph className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <Text id="graph-explorer-heading" as="h2" variant="body" weight="semibold">
                            Graph Explorer
                        </Text>
                        <Text as="p" variant="meta" tone="tertiary" className="mt-0.5">
                            Connection index
                        </Text>
                    </div>
                </div>
            </div>

            <Text id="graph-selection-status" as="p" role="status" aria-live="polite" className="sr-only">
                {selectedNode
                    ? `${selectedNodeStatus}${
                          selectedConnectedNodes.length > 0
                              ? `. Linked to ${selectedConnectedNodes.map((node) => node.title || 'Untitled').join(', ')}`
                              : ''
                      }`
                    : selectedNodeStatus}
            </Text>

            <div className="border-b border-border-subtle/80 px-4 py-3">
                {selectedNode ? (
                    <div className="min-w-0">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <Text as="p" variant="body" weight="semibold" truncate>
                                    {selectedNode.title || 'Untitled'}
                                </Text>
                                <Text as="p" variant="meta" tone="tertiary" className="mt-0.5">
                                    {selectedNode.connections} links
                                </Text>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                <button
                                    type="button"
                                    onClick={onClearSelection}
                                    className="focus-ring-soft inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                                    aria-label="Deselect node"
                                >
                                    <Icon.Close className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                                <Link
                                    to={NOTE_ROUTE}
                                    params={{ id: selectedNode.id }}
                                    aria-label={`Open ${selectedNode.title || 'Untitled'}`}
                                    className="focus-ring-soft inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                                >
                                    <Icon.ArrowRight className="h-4 w-4" aria-hidden="true" />
                                </Link>
                            </div>
                        </div>
                        {visibleSelectedConnections.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {visibleSelectedConnections.map((node) => (
                                    <Link
                                        key={node.id}
                                        to={NOTE_ROUTE}
                                        params={{ id: node.id }}
                                        className="focus-ring-soft inline-flex max-w-full items-center gap-1 rounded-full border border-border-subtle bg-subtle px-2 py-0.5 text-xs font-medium text-fg-secondary outline-none transition-colors hover:border-border-secondary hover:bg-hover-subtle hover:text-fg-default"
                                    >
                                        <Icon.LinkIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                                        <span className="truncate">{node.title || 'Untitled'}</span>
                                    </Link>
                                ))}
                                {remainingSelectedConnectionCount > 0 && (
                                    <span className="inline-flex items-center rounded-full border border-border-subtle px-2 py-0.5 text-xs font-medium text-fg-tertiary">
                                        +{remainingSelectedConnectionCount}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div>
                        <Text as="p" variant="body" weight="semibold">
                            No graph node selected
                        </Text>
                        <Text as="p" variant="meta" tone="tertiary" className="mt-0.5">
                            {graphNodes[0]?.title ? `Most linked: ${graphNodes[0].title}` : 'No linked notes'}
                        </Text>
                    </div>
                )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
                <div className="border-b border-border-subtle/60 px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                        <Text as="h3" variant="label" weight="semibold">
                            Notes
                        </Text>
                        <Text as="span" variant="meta" tone="tertiary" className="shrink-0">
                            {filteredGraphNodes.length} shown
                        </Text>
                    </div>
                    <div className="relative mt-2">
                        <Icon.Search
                            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-fg-tertiary"
                            aria-hidden="true"
                        />
                        <Input
                            id="graph-node-search"
                            size="sm"
                            value={nodeSearchQuery}
                            onChange={(event) => onNodeSearchQueryChange(event.target.value)}
                            placeholder="Find a note"
                            aria-label="Search graph"
                            className="pl-9"
                        />
                    </div>
                </div>
                {filteredGraphNodes.length > 0 ? (
                    <div
                        ref={nodeListRef}
                        role="list"
                        aria-label="Graph notes"
                        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
                    >
                        <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                            {virtualRows.map((virtualRow) => {
                                const node = filteredGraphNodes[virtualRow.index];
                                if (!node) {
                                    return null;
                                }

                                const isSelected = selectedNodeId === node.id;
                                const nodeTitle = node.title || 'Untitled';

                                return (
                                    <div
                                        key={virtualRow.key}
                                        ref={rowVirtualizer.measureElement}
                                        role="listitem"
                                        aria-posinset={virtualRow.index + 1}
                                        aria-setsize={filteredGraphNodes.length}
                                        data-index={virtualRow.index}
                                        className={classNames(
                                            'absolute top-0 left-0 w-full min-w-0 overflow-hidden border-b border-border-subtle/60',
                                            virtualRow.index === filteredGraphNodes.length - 1 && 'border-b-0',
                                        )}
                                        style={{ transform: `translateY(${virtualRow.start}px)` }}
                                    >
                                        <div
                                            className={classNames(
                                                'grid min-w-0 grid-cols-[minmax(0,1fr)_3.5rem] items-center overflow-hidden transition-colors',
                                                isSelected
                                                    ? 'bg-elevated text-fg-default'
                                                    : 'text-fg-secondary hover:bg-hover-subtle hover:text-fg-default',
                                            )}
                                        >
                                            <button
                                                type="button"
                                                aria-pressed={isSelected}
                                                aria-describedby={isSelected ? 'graph-selection-status' : undefined}
                                                onClick={() => onSelectNode(node.id)}
                                                className="focus-ring-soft group grid min-w-0 grid-cols-[3px_minmax(0,1fr)_2.75rem] items-center gap-3 overflow-hidden px-4 py-3 text-left outline-none"
                                            >
                                                <span
                                                    className={classNames(
                                                        'h-8 rounded-full transition-colors',
                                                        isSelected
                                                            ? 'bg-fg-default'
                                                            : 'bg-border-subtle group-hover:bg-border-secondary',
                                                    )}
                                                    aria-hidden="true"
                                                />
                                                <span className="min-w-0 overflow-hidden">
                                                    <Text
                                                        as="span"
                                                        variant="meta"
                                                        weight={isSelected ? 'semibold' : 'medium'}
                                                        truncate
                                                        className="block min-w-0"
                                                    >
                                                        {nodeTitle}
                                                    </Text>
                                                </span>
                                                <Text
                                                    as="span"
                                                    variant="label"
                                                    weight="medium"
                                                    tone={isSelected ? 'secondary' : 'tertiary'}
                                                    className="min-w-8 justify-self-end text-right tabular-nums"
                                                >
                                                    <span aria-hidden="true">{node.connections}</span>
                                                    <span className="sr-only">{node.connections} links</span>
                                                </Text>
                                            </button>
                                            <Link
                                                to={NOTE_ROUTE}
                                                params={{ id: node.id }}
                                                aria-label={`Open ${nodeTitle}`}
                                                className="focus-ring-soft inline-flex h-9 w-9 shrink-0 items-center justify-center justify-self-center rounded-[10px] text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                                            >
                                                <Icon.ArrowRight className="h-4 w-4" aria-hidden="true" />
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <Text as="p" variant="meta" tone="tertiary" className="px-4 py-5 text-center">
                        No matching graph nodes
                    </Text>
                )}
            </div>
        </section>
    );
}
