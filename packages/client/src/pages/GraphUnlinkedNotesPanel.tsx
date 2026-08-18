import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';
import { timeSince } from '~/modules/time';
import { NOTE_ROUTE } from '~/modules/url';
import { filterGraphNodes, type GraphVisualNode } from './graph-data';

interface GraphUnlinkedNotesPanelProps {
    nodes: GraphVisualNode[];
}

function formatUpdatedAt(updatedAt: string) {
    const timestamp = Number(updatedAt);
    return Number.isFinite(timestamp) ? `Updated ${timeSince(timestamp)}` : 'Recently updated';
}

export function GraphUnlinkedNotesPanel({ nodes }: GraphUnlinkedNotesPanelProps) {
    const [query, setQuery] = useState('');
    const sortedNodes = useMemo(
        () =>
            [...nodes].sort(
                (first, second) =>
                    Number(second.updatedAt) - Number(first.updatedAt) || first.title.localeCompare(second.title),
            ),
        [nodes],
    );
    const filteredNodes = useMemo(() => filterGraphNodes(sortedNodes, query), [query, sortedNodes]);

    return (
        <section
            aria-labelledby="graph-unlinked-notes-heading"
            className="border-t border-border-subtle/80 px-4 py-4 sm:px-5"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <Text id="graph-unlinked-notes-heading" as="h3" variant="subheading" weight="semibold">
                        Review notes without connections
                    </Text>
                    <Text as="p" variant="label" tone="tertiary" className="mt-1">
                        Start with recently updated notes. Some notes may be intentionally standalone.
                    </Text>
                </div>
                <Text as="span" variant="meta" tone="tertiary" className="shrink-0 tabular-nums">
                    {filteredNodes.length}/{nodes.length}
                </Text>
            </div>

            <div className="mt-3 flex h-10 items-center gap-2 rounded-[10px] border border-border-subtle bg-surface px-3 focus-within:border-border-focus">
                <Icon.Search className="h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden="true" />
                <input
                    type="search"
                    aria-label="Search notes without connections"
                    placeholder="Search notes"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm text-fg-default outline-none placeholder:text-fg-placeholder"
                />
            </div>

            {filteredNodes.length > 0 ? (
                <div className="mt-3 max-h-80 overflow-y-auto overscroll-contain rounded-[12px] border border-border-subtle/70">
                    <ul className="divide-y divide-border-subtle/70">
                        {filteredNodes.map((node) => (
                            <li key={node.id}>
                                <Link
                                    to={NOTE_ROUTE}
                                    params={{ id: node.id }}
                                    className="focus-ring-soft flex min-w-0 items-center gap-3 px-3 py-2.5 text-left outline-none transition-colors hover:bg-hover-subtle hover:text-accent-primary"
                                >
                                    <Icon.FileNote className="h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden="true" />
                                    <span className="block min-w-0 flex-1">
                                        <Text
                                            as="span"
                                            variant="body"
                                            weight="semibold"
                                            className="block min-w-0 truncate"
                                        >
                                            {node.title || 'Untitled'}
                                        </Text>
                                        <Text as="span" variant="label" tone="tertiary" className="mt-0.5 block">
                                            {formatUpdatedAt(node.updatedAt)}
                                        </Text>
                                    </span>
                                    <Icon.ArrowRight className="h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden="true" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <Text as="p" variant="label" tone="tertiary" className="py-8 text-center">
                    No matching notes
                </Text>
            )}
        </section>
    );
}
