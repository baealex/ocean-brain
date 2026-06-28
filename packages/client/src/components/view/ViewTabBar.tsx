import type { DragEndEvent } from '@dnd-kit/core';
import { closestCenter, DndContext, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import classNames from 'classnames';

import * as Icon from '~/components/icon';
import { Button } from '~/components/shared';
import type { ViewTab } from '~/models/view.model';

const tabChromeClassName =
    'group flex h-10 max-w-[72vw] shrink-0 items-center rounded-[12px] border transition-[background-color,border-color,color,box-shadow] sm:max-w-[176px]';
const tabTriggerClassName =
    'focus-ring-soft inline-flex h-full min-w-0 flex-1 touch-pan-x items-center gap-1 rounded-[11px] px-3 text-[13px] font-medium outline-none transition-colors';

interface SortableViewTabProps {
    tab: ViewTab;
    isActive: boolean;
    onSelect: () => void;
}

function SortableViewTab({ tab, isActive, onSelect }: SortableViewTabProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: tab.id,
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
                tabChromeClassName,
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
                title={`${tab.title}. Drag to reorder.`}
                className={classNames(
                    tabTriggerClassName,
                    isActive ? 'text-fg-default' : 'text-fg-secondary group-hover:text-fg-default',
                    isDragging ? 'cursor-grabbing' : 'cursor-pointer',
                )}
                onClick={onSelect}
            >
                <span className="min-w-0 flex-1 truncate">{tab.title}</span>
                <span className="inline-flex min-w-4 shrink-0 items-center justify-center rounded-full bg-hover-subtle/75 px-1 py-0 text-[10px] leading-4 text-current/70">
                    {tab.sections.length}
                </span>
            </button>
        </div>
    );
}

interface ViewTabBarProps {
    tabs: ViewTab[];
    activeTabId: string | null;
    onSelectTab: (tab: ViewTab) => void | Promise<void>;
    onReorderTabs: (event: DragEndEvent) => void | Promise<void>;
    onCreateTab: () => void;
}

export default function ViewTabBar({ tabs, activeTabId, onSelectTab, onReorderTabs, onCreateTab }: ViewTabBarProps) {
    const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 8 } }));

    return (
        <div className="-mx-1 rounded-[16px] border border-border-subtle/75 bg-subtle/50 p-1 sm:mx-0">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToHorizontalAxis]}
                autoScroll={false}
                onDragEnd={(event) => void onReorderTabs(event)}
            >
                <div className="flex items-center gap-1">
                    <SortableContext items={tabs.map((tab) => tab.id)} strategy={horizontalListSortingStrategy}>
                        <div
                            role="tablist"
                            aria-label="Views tab list"
                            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden"
                        >
                            {tabs.map((tab) => (
                                <SortableViewTab
                                    key={tab.id}
                                    tab={tab}
                                    isActive={tab.id === activeTabId}
                                    onSelect={() => void onSelectTab(tab)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                    <Button
                        type="button"
                        aria-label="New view tab"
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 shrink-0 rounded-[12px] border-transparent bg-transparent px-0 text-[13px] text-fg-secondary hover:border-border-subtle/80 hover:bg-hover-subtle hover:text-fg-default sm:w-auto sm:px-2.5"
                        onClick={onCreateTab}
                    >
                        <Icon.Plus className="h-5 w-5 shrink-0" />
                        <span className="hidden sm:inline">New view tab</span>
                    </Button>
                </div>
            </DndContext>
        </div>
    );
}
