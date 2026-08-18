import classNames from 'classnames';

import * as Icon from '~/components/icon';
import { Text } from '~/components/ui';
import { useTheme } from '~/store/theme';
import type { GraphVisualNode } from './graph-data';
import { getGraphClusterColor } from './graph-theme';

interface GraphConnectedNodeListProps {
    className?: string;
    nodes: GraphVisualNode[];
    onSelectNode: (nodeId: string) => void;
}

export function GraphConnectedNodeList({ className, nodes, onSelectNode }: GraphConnectedNodeListProps) {
    const { theme } = useTheme((state) => state);

    return (
        <div className={classNames('w-full overflow-x-auto overscroll-contain pb-1', className)}>
            <ul className="flex w-max min-w-full gap-2" aria-label="Connected notes">
                {nodes.map((node) => (
                    <li key={node.id}>
                        <button
                            type="button"
                            onClick={() => onSelectNode(node.id)}
                            className="focus-ring-soft flex h-9 max-w-52 min-w-28 shrink-0 items-center gap-2 rounded-[10px] border border-border-subtle bg-surface px-2.5 text-left text-fg-secondary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default"
                            title={node.title || 'Untitled'}
                        >
                            <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: getGraphClusterColor(theme, node.clusterColorIndex) }}
                                aria-hidden="true"
                            />
                            <Text as="span" variant="meta" weight="medium" truncate>
                                {node.title || 'Untitled'}
                            </Text>
                            <Icon.ArrowRight className="h-3.5 w-3.5 shrink-0 text-fg-tertiary" aria-hidden="true" />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
