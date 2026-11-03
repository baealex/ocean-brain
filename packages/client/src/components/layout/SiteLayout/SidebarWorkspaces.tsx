import type { DragEndEvent } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import classNames from 'classnames';
import { reorderWorkspaces } from '~/apis/workspace.api';
import * as Icon from '~/components/icon';
import { VerticalSortable } from '~/components/shared';
import { Text } from '~/components/ui';
import type { Workspace } from '~/models/workspace.model';
import { queryKeys } from '~/modules/query-key-factory';
import { validateHomeSearch } from '~/modules/route-search';
import { HOME_ROUTE, NEW_NOTE_ID, NOTE_ROUTE, SETTINGS_WORKSPACE_ROUTE } from '~/modules/url';
import { useWorkspace } from '~/store/workspace';

import PinnedNotesPanel from './PinnedNotesPanel';

const headerClassName =
    'group flex min-h-[38px] select-none items-center gap-1 rounded-[12px] pr-1 transition-colors hover:bg-hover-subtle/70 [-webkit-touch-callout:none]';
const nameLinkClassName =
    'focus-ring-soft flex min-w-0 flex-1 items-center gap-2 rounded-[10px] px-2 py-1.5 outline-none transition-colors';
const actionClassName =
    'focus-ring-soft inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-fg-tertiary outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default min-[1000px]:size-8';

export const moveWorkspace = (workspaces: Workspace[], activeId: string, overId: string) => {
    const from = workspaces.findIndex((workspace) => workspace.id === activeId);
    const to = workspaces.findIndex((workspace) => workspace.id === overId);

    if (from < 0 || to < 0 || from === to) {
        return null;
    }

    const next = [...workspaces];
    next.splice(to, 0, ...next.splice(from, 1));
    return next;
};

interface SortableWorkspaceProps {
    workspace: Workspace;
    isCurrent: boolean;
}

function SortableWorkspace({ workspace, isCurrent }: SortableWorkspaceProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: workspace.id,
    });

    return (
        <section
            ref={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
            aria-label={workspace.name}
        >
            <div {...listeners} className={classNames(headerClassName, isDragging && 'cursor-grabbing')}>
                <Link
                    to={HOME_ROUTE}
                    search={{ ...validateHomeSearch({}), workspace: workspace.id }}
                    aria-current={isCurrent ? 'true' : undefined}
                    className={classNames(
                        nameLinkClassName,
                        isCurrent ? 'text-fg-default' : 'text-fg-secondary hover:text-fg-default',
                    )}
                >
                    <Icon.Grid
                        className={classNames('size-4 shrink-0', isCurrent ? 'text-fg-default' : 'text-fg-tertiary')}
                        weight={isCurrent ? 'fill' : 'regular'}
                        aria-hidden="true"
                    />
                    <Text as="span" truncate variant="meta" weight={isCurrent ? 'semibold' : 'medium'} tone="current">
                        {workspace.name}
                    </Text>
                </Link>
                <button
                    type="button"
                    ref={setActivatorNodeRef}
                    aria-label={`Reorder workspace ${workspace.name}`}
                    {...attributes}
                    className="focus-ring-soft sr-only rounded-[8px] text-fg-tertiary outline-none focus-visible:not-sr-only"
                >
                    <span className="flex h-6 w-6 items-center justify-center">
                        <Icon.DragHandle className="size-4" />
                    </span>
                </button>
                {workspace.archivedAt ? (
                    <Text as="span" variant="label" tone="tertiary" className="shrink-0 px-1">
                        Archived · read only
                    </Text>
                ) : (
                    <Link
                        to={NOTE_ROUTE}
                        params={{ id: NEW_NOTE_ID }}
                        search={{ workspace: workspace.id }}
                        aria-label={`New note in ${workspace.name}`}
                        title="New note"
                        className={actionClassName}
                    >
                        <Icon.Plus className="size-4" weight="bold" />
                    </Link>
                )}
                <Link
                    to={SETTINGS_WORKSPACE_ROUTE}
                    search={{ workspace: workspace.id }}
                    aria-label={`${workspace.name} settings`}
                    title="Workspace settings"
                    className={actionClassName}
                >
                    <Icon.Gear className="size-4" />
                </Link>
            </div>
            <div className="ml-[15px]">
                <PinnedNotesPanel workspaceId={workspace.id} emptyMessage="No pinned notes" />
            </div>
        </section>
    );
}

const SidebarWorkspaces = () => {
    const { workspaceId, workspaces } = useWorkspace();
    const queryClient = useQueryClient();
    const visibleWorkspaces = workspaces.filter((workspace) => !workspace.archivedAt || workspace.id === workspaceId);
    const reorder = useMutation({
        mutationFn: async (ids: string[]) => {
            const response = await reorderWorkspaces(ids);
            if (response.type === 'error') throw new Error(response.errors[0].message);
            return response.reorderWorkspaces;
        },
        onError: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.list() }),
    });

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        const next = over ? moveWorkspace(workspaces, String(active.id), String(over.id)) : null;

        if (!next) {
            return;
        }

        queryClient.setQueryData(queryKeys.workspaces.list(), next);
        reorder.mutate(next.map((workspace) => workspace.id));
    };

    return (
        <nav className="p-3" aria-label="Workspaces">
            <div className="flex flex-col gap-2">
                <VerticalSortable
                    items={visibleWorkspaces.map((workspace) => workspace.id)}
                    longPressOnTouch
                    restrictToList
                    onDragEnd={handleDragEnd}
                >
                    {visibleWorkspaces.map((workspace) => (
                        <SortableWorkspace
                            key={workspace.id}
                            workspace={workspace}
                            isCurrent={workspace.id === workspaceId}
                        />
                    ))}
                </VerticalSortable>
            </div>
        </nav>
    );
};

export default SidebarWorkspaces;
