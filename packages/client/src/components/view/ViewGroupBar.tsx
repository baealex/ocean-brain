import type { DragEndEvent } from '@dnd-kit/core';
import { closestCenter, DndContext, KeyboardSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import {
    horizontalListSortingStrategy,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import classNames from 'classnames';

import * as Icon from '~/components/icon';
import { Button } from '~/components/shared';
import type { ViewGroup } from '~/models/view.model';

const groupChromeClassName =
    'group flex h-10 max-w-[72vw] shrink-0 items-center rounded-[12px] border transition-[background-color,border-color,color,box-shadow] sm:max-w-[176px]';
const groupTriggerClassName =
    'focus-ring-soft inline-flex h-full min-w-0 flex-1 touch-pan-x items-center gap-1 rounded-[11px] px-3 text-[13px] font-medium outline-none transition-colors';

interface SortableViewGroupProps {
    readOnly?: boolean;
    group: ViewGroup;
    isActive: boolean;
    onSelect: () => void;
}

function SortableViewGroup({ group, isActive, onSelect, readOnly = false }: SortableViewGroupProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: group.id,
        disabled: readOnly,
    });

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                transition,
                opacity: isDragging ? 0.6 : 1,
            }}
            className={classNames(
                groupChromeClassName,
                isActive
                    ? 'border-border-secondary/80 bg-elevated text-fg-default shadow-[0_8px_18px_-18px_rgba(15,18,24,0.28)]'
                    : 'border-transparent bg-transparent text-fg-secondary hover:border-border-subtle/80 hover:bg-hover-subtle hover:text-fg-default',
            )}
        >
            <button
                type="button"
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                role="tab"
                aria-selected={isActive}
                title={`${group.title}. Drag to reorder.`}
                className={classNames(
                    groupTriggerClassName,
                    isActive ? 'text-fg-default' : 'text-fg-secondary group-hover:text-fg-default',
                    isDragging ? 'cursor-grabbing' : 'cursor-pointer',
                )}
                onClick={onSelect}
            >
                <span className="min-w-0 flex-1 truncate">{group.title}</span>
                <span className="inline-flex min-w-4 shrink-0 items-center justify-center rounded-full bg-hover-subtle/75 px-1 py-0 text-[10px] leading-4 text-current">
                    {group.views.length}
                </span>
            </button>
        </div>
    );
}

interface ViewGroupBarProps {
    readOnly?: boolean;
    groups: ViewGroup[];
    activeGroupId: string | null;
    onSelectGroup: (group: ViewGroup) => void | Promise<void>;
    onReorderGroups: (event: DragEndEvent) => void | Promise<void>;
    onCreateGroup: () => void;
}

export default function ViewGroupBar({
    readOnly = false,
    groups,
    activeGroupId,
    onSelectGroup,
    onReorderGroups,
    onCreateGroup,
}: ViewGroupBarProps) {
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    return (
        <div className="-mx-1 rounded-[16px] border border-border-subtle/75 bg-subtle/50 p-1 sm:mx-0">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToHorizontalAxis]}
                autoScroll={false}
                onDragEnd={(event) => void onReorderGroups(event)}
            >
                <div className="flex items-center gap-1">
                    <SortableContext items={groups.map((group) => group.id)} strategy={horizontalListSortingStrategy}>
                        <div
                            role="tablist"
                            aria-label="View groups"
                            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden"
                        >
                            {groups.map((group) => (
                                <SortableViewGroup
                                    readOnly={readOnly}
                                    key={group.id}
                                    group={group}
                                    isActive={group.id === activeGroupId}
                                    onSelect={() => void onSelectGroup(group)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                    <Button
                        type="button"
                        disabled={readOnly}
                        aria-label="New view group"
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 shrink-0 rounded-[12px] border-transparent bg-transparent px-0 text-[13px] text-fg-secondary hover:border-border-subtle/80 hover:bg-hover-subtle hover:text-fg-default sm:w-auto sm:px-2.5"
                        onClick={onCreateGroup}
                    >
                        <Icon.Plus className="h-5 w-5 shrink-0" />
                        <span className="hidden sm:inline">New view group</span>
                    </Button>
                </div>
            </DndContext>
        </div>
    );
}
