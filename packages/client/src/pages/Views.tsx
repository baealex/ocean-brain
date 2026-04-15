import type { DragEndEvent } from '@dnd-kit/core';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToHorizontalAxis, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
    horizontalListSortingStrategy,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames';
import { useState } from 'react';

import { fetchTags } from '~/apis/tag.api';
import {
    createViewSection,
    createViewTab,
    deleteViewSection,
    deleteViewTab,
    fetchViewWorkspace,
    reorderViewSections,
    reorderViewTabs,
    setActiveViewTab,
    updateViewSection,
    updateViewTab,
} from '~/apis/view.api';
import * as Icon from '~/components/icon';
import { Button, Dropdown, Empty, PageLayout, Skeleton, SurfaceCard } from '~/components/shared';
import { MoreButton, Text, useConfirm, useToast } from '~/components/ui';
import { ViewSectionCard, ViewSectionDialog, ViewTabDialog } from '~/components/view';
import type { ViewSection, ViewsWorkspace, ViewTab } from '~/models/view.model';
import { queryKeys } from '~/modules/query-key-factory';
import {
    EMPTY_VIEWS_WORKSPACE,
    getActiveViewTab,
    reorderViewSectionsInWorkspace,
    reorderViewTabsInWorkspace,
    setActiveViewTabInWorkspace,
} from '~/modules/view-dashboard';

const pageDescription = 'Save tag-based views and switch between them without leaving your notes.';

type ViewTabDialogState = { mode: 'create' } | { mode: 'edit'; tab: ViewTab } | null;
type ViewSectionDialogState = { mode: 'create' } | { mode: 'edit'; section: ViewSection } | null;

const dragHandleClassName =
    'focus-ring-soft inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-fg-default/70 outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default touch-none';
const tabChromeClassName =
    'group relative -mb-px flex h-10 min-w-[92px] max-w-[118px] shrink-0 items-center gap-0.5 rounded-t-[12px] border border-b-0 px-1.5 transition-[background-color,border-color,color,box-shadow]';
const tabTriggerClassName =
    'focus-ring-soft inline-flex min-w-0 flex-1 items-center gap-1 rounded-[9px] px-0.5 py-1.5 text-[13px] font-medium outline-none';
const tabDragHandleClassName =
    'focus-ring-soft inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] text-current/55 outline-none transition-[background-color,color,opacity] hover:bg-hover-subtle hover:text-current touch-none';
const addTabActionClassName =
    'focus-ring-soft relative mb-0.5 inline-flex h-9 shrink-0 items-center gap-1 rounded-[10px] px-2.5 text-[13px] font-medium text-fg-secondary outline-none transition-colors hover:bg-hover-subtle/85 hover:text-fg-default';

interface SortableViewTabProps {
    tab: ViewTab;
    isActive: boolean;
    onSelect: () => void;
}

const SortableViewTab = ({ tab, isActive, onSelect }: SortableViewTabProps) => {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: tab.id,
    });

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0.6 : 1,
            }}
            className={classNames(
                tabChromeClassName,
                isActive
                    ? 'z-10 border-border-secondary/75 bg-elevated text-fg-default shadow-[0_10px_18px_-20px_rgba(15,18,24,0.24)]'
                    : 'border-transparent bg-hover-subtle/45 text-fg-secondary hover:bg-hover-subtle/75 hover:text-fg-default',
            )}
        >
            <button
                type="button"
                ref={setActivatorNodeRef}
                aria-label={`Reorder view tab ${tab.title}`}
                {...attributes}
                {...listeners}
                className={classNames(
                    tabDragHandleClassName,
                    isDragging ? 'cursor-grabbing opacity-100' : 'cursor-grab opacity-70 group-hover:opacity-100',
                )}
            >
                <Icon.DragHandle className="size-4" />
            </button>
            <button
                type="button"
                role="tab"
                aria-selected={isActive}
                className={classNames(
                    tabTriggerClassName,
                    isActive ? 'text-fg-default' : 'text-fg-secondary group-hover:text-fg-default',
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
};

interface SortableViewSectionProps {
    section: ViewSection;
    onEdit: () => void;
    onDelete: () => void;
}

const SortableViewSection = ({ section, onEdit, onDelete }: SortableViewSectionProps) => {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: section.id,
    });

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0.6 : 1,
            }}
        >
            <ViewSectionCard
                section={section}
                onEdit={onEdit}
                onDelete={onDelete}
                dragHandle={
                    <button
                        type="button"
                        ref={setActivatorNodeRef}
                        aria-label={`Reorder section ${section.title}`}
                        {...attributes}
                        {...listeners}
                        className={classNames(dragHandleClassName, isDragging ? 'cursor-grabbing' : 'cursor-grab')}
                    >
                        <Icon.DragHandle className="size-4" />
                    </button>
                }
            />
        </div>
    );
};

export default function Views() {
    const confirm = useConfirm();
    const toast = useToast();
    const queryClient = useQueryClient();
    const [tabDialogState, setTabDialogState] = useState<ViewTabDialogState>(null);
    const [sectionDialogState, setSectionDialogState] = useState<ViewSectionDialogState>(null);

    const {
        data: workspaceData,
        isPending: isWorkspaceLoading,
        isError: isWorkspaceError,
        refetch: refetchWorkspace,
    } = useQuery({
        queryKey: queryKeys.views.workspace(),
        async queryFn() {
            const response = await fetchViewWorkspace();

            if (response.type === 'error') {
                throw response;
            }

            return response.viewWorkspace;
        },
    });

    const workspace = workspaceData ?? EMPTY_VIEWS_WORKSPACE;
    const activeTab = getActiveViewTab(workspace);

    const { data: tagData, isPending: isTagsLoading } = useQuery({
        queryKey: queryKeys.tags.list({ limit: 200 }),
        async queryFn() {
            const response = await fetchTags({ limit: 200 });

            if (response.type === 'error') {
                throw response;
            }

            return response.allTags;
        },
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const availableTags = tagData?.tags ?? [];

    const syncWorkspace = (nextWorkspace: ViewsWorkspace) => {
        queryClient.setQueryData(queryKeys.views.workspace(), nextWorkspace);
    };

    const invalidateViews = async () => {
        await queryClient.invalidateQueries({
            queryKey: queryKeys.views.all(),
            exact: false,
        });
    };

    const handleTabDragEnd = async ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) {
            return;
        }

        const previousWorkspace = queryClient.getQueryData<ViewsWorkspace>(queryKeys.views.workspace()) ?? workspace;
        const nextWorkspace = reorderViewTabsInWorkspace(previousWorkspace, String(active.id), String(over.id));

        syncWorkspace(nextWorkspace);

        const response = await reorderViewTabs(nextWorkspace.tabs.map((tab) => tab.id));

        if (response.type === 'error') {
            syncWorkspace(previousWorkspace);
            toast(response.errors[0].message);
            return;
        }

        await invalidateViews();
    };

    const handleSectionDragEnd = async ({ active, over }: DragEndEvent) => {
        if (!activeTab || !over || active.id === over.id) {
            return;
        }

        const previousWorkspace = queryClient.getQueryData<ViewsWorkspace>(queryKeys.views.workspace()) ?? workspace;
        const nextWorkspace = reorderViewSectionsInWorkspace(
            previousWorkspace,
            activeTab.id,
            String(active.id),
            String(over.id),
        );

        syncWorkspace(nextWorkspace);

        const response = await reorderViewSections(
            activeTab.id,
            nextWorkspace.tabs.find((tab) => tab.id === activeTab.id)?.sections.map((section) => section.id) ?? [],
        );

        if (response.type === 'error') {
            syncWorkspace(previousWorkspace);
            toast(response.errors[0].message);
            return;
        }

        await invalidateViews();
    };

    const handleCreateTab = async (title: string) => {
        const response = await createViewTab(title);

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        await invalidateViews();
        setTabDialogState(null);
    };

    const handleUpdateTab = async (title: string) => {
        if (!activeTab) {
            return;
        }

        const response = await updateViewTab(activeTab.id, title);

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        await invalidateViews();
        setTabDialogState(null);
    };

    const handleDeleteActiveTab = async () => {
        if (!activeTab) {
            return;
        }

        if (!(await confirm('Delete this view tab and all of its sections?'))) {
            return;
        }

        const response = await deleteViewTab(activeTab.id);

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        await invalidateViews();
    };

    const handleCreateSection = async (draft: {
        title: string;
        tagNames: string[];
        mode: ViewSection['mode'];
        limit: number;
    }) => {
        if (!activeTab) {
            return;
        }

        const response = await createViewSection(activeTab.id, draft);

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        await invalidateViews();
        setSectionDialogState(null);
    };

    const handleUpdateSection = async (draft: {
        title: string;
        tagNames: string[];
        mode: ViewSection['mode'];
        limit: number;
    }) => {
        if (!activeTab || !sectionDialogState || sectionDialogState.mode !== 'edit') {
            return;
        }

        const response = await updateViewSection(sectionDialogState.section.id, draft);

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        await invalidateViews();
        setSectionDialogState(null);
    };

    const handleDeleteSection = async (sectionId: string) => {
        if (!activeTab) {
            return;
        }

        if (!(await confirm('Delete this section from the current view tab?'))) {
            return;
        }

        const response = await deleteViewSection(sectionId);

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        await invalidateViews();
    };

    return (
        <>
            <PageLayout title="Views" description={pageDescription}>
                {isWorkspaceLoading && !workspaceData ? (
                    <SurfaceCard className="px-6 py-8 sm:px-8 sm:py-10">
                        <div className="flex flex-col gap-4">
                            <Skeleton height={20} width={180} className="rounded-full" />
                            <Skeleton height={16} width={260} className="rounded-full" />
                            <Skeleton height={44} width={140} className="rounded-[12px]" />
                        </div>
                    </SurfaceCard>
                ) : isWorkspaceError ? (
                    <SurfaceCard className="px-6 py-8 sm:px-8 sm:py-10">
                        <Text as="p" variant="body" weight="semibold">
                            Failed to load saved views
                        </Text>
                        <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                            Retry loading your saved view tabs.
                        </Text>
                        <div className="mt-4">
                            <Button type="button" variant="ghost" size="sm" onClick={() => void refetchWorkspace()}>
                                Retry
                            </Button>
                        </div>
                    </SurfaceCard>
                ) : workspace.tabs.length === 0 ? (
                    <SurfaceCard className="px-6 py-8 sm:px-8 sm:py-10">
                        <Empty
                            title="Create your first view tab"
                            description="Start with a saved view tab, then add tag-based sections inside it."
                        />
                        <div className="mt-6 flex justify-center">
                            <Button type="button" onClick={() => setTabDialogState({ mode: 'create' })}>
                                <Icon.Plus className="h-4 w-4" />
                                Create first tab
                            </Button>
                        </div>
                    </SurfaceCard>
                ) : (
                    <div className="flex flex-col gap-6">
                        <div className="border-b border-border-secondary/75">
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                modifiers={[restrictToHorizontalAxis]}
                                onDragEnd={handleTabDragEnd}
                            >
                                <div className="flex items-end gap-1 overflow-x-auto overflow-y-hidden pb-px">
                                    <SortableContext
                                        items={workspace.tabs.map((tab) => tab.id)}
                                        strategy={horizontalListSortingStrategy}
                                    >
                                        <div
                                            role="tablist"
                                            aria-label="Views tab list"
                                            className="flex min-w-0 items-end gap-1"
                                        >
                                            {workspace.tabs.map((tab) => (
                                                <SortableViewTab
                                                    key={tab.id}
                                                    tab={tab}
                                                    isActive={tab.id === activeTab?.id}
                                                    onSelect={async () => {
                                                        const previousWorkspace =
                                                            queryClient.getQueryData<ViewsWorkspace>(
                                                                queryKeys.views.workspace(),
                                                            ) ?? workspace;
                                                        const nextWorkspace = setActiveViewTabInWorkspace(
                                                            previousWorkspace,
                                                            tab.id,
                                                        );

                                                        syncWorkspace(nextWorkspace);

                                                        const response = await setActiveViewTab(tab.id);

                                                        if (response.type === 'error') {
                                                            syncWorkspace(previousWorkspace);
                                                            toast(response.errors[0].message);
                                                            return;
                                                        }

                                                        syncWorkspace(response.setActiveViewTab);
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                    <button
                                        type="button"
                                        className={addTabActionClassName}
                                        onClick={() => setTabDialogState({ mode: 'create' })}
                                    >
                                        <Icon.Plus className="size-4" />
                                        Add tab
                                    </button>
                                </div>
                            </DndContext>
                        </div>

                        {activeTab && (
                            <div className="flex flex-col gap-5">
                                <SurfaceCard className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <Text as="h2" variant="heading" weight="bold" tracking="tight">
                                            {activeTab.title}
                                        </Text>
                                        <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                                            {activeTab.sections.length > 0
                                                ? `${activeTab.sections.length} section${activeTab.sections.length === 1 ? '' : 's'} in this view`
                                                : 'Add sections to build this view'}
                                        </Text>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => setSectionDialogState({ mode: 'create' })}
                                        >
                                            <Icon.Plus className="h-4 w-4" />
                                            Add section
                                        </Button>
                                        <Dropdown
                                            button={<MoreButton label="View tab actions" />}
                                            items={[
                                                {
                                                    name: 'Rename',
                                                    onClick: () => setTabDialogState({ mode: 'edit', tab: activeTab }),
                                                },
                                                { type: 'separator' },
                                                {
                                                    name: 'Delete tab',
                                                    onClick: () => void handleDeleteActiveTab(),
                                                },
                                            ]}
                                        />
                                    </div>
                                </SurfaceCard>

                                {activeTab.sections.length === 0 ? (
                                    <SurfaceCard className="px-6 py-8 sm:px-8 sm:py-10">
                                        <Empty
                                            title="Add the first section to this tab"
                                            description="Sections pull notes by tag."
                                        />
                                    </SurfaceCard>
                                ) : (
                                    <div className="flex flex-col">
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            modifiers={[restrictToVerticalAxis]}
                                            onDragEnd={handleSectionDragEnd}
                                        >
                                            <SortableContext
                                                items={activeTab.sections.map((section) => section.id)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                <div className="flex flex-col gap-4">
                                                    {activeTab.sections.map((section) => (
                                                        <SortableViewSection
                                                            key={section.id}
                                                            section={section}
                                                            onEdit={() =>
                                                                setSectionDialogState({ mode: 'edit', section })
                                                            }
                                                            onDelete={() => void handleDeleteSection(section.id)}
                                                        />
                                                    ))}
                                                </div>
                                            </SortableContext>
                                        </DndContext>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </PageLayout>

            <ViewTabDialog
                open={tabDialogState !== null}
                mode={tabDialogState?.mode ?? 'create'}
                initialTitle={tabDialogState?.mode === 'edit' ? tabDialogState.tab.title : ''}
                onClose={() => setTabDialogState(null)}
                onSubmit={(title) => {
                    if (tabDialogState?.mode === 'edit') {
                        handleUpdateTab(title);
                        return;
                    }

                    handleCreateTab(title);
                }}
            />

            <ViewSectionDialog
                open={sectionDialogState !== null}
                mode={sectionDialogState?.mode ?? 'create'}
                initialSection={sectionDialogState?.mode === 'edit' ? sectionDialogState.section : null}
                availableTags={availableTags}
                isTagsLoading={isTagsLoading}
                onClose={() => setSectionDialogState(null)}
                onSubmit={(draft) => {
                    if (sectionDialogState?.mode === 'edit') {
                        handleUpdateSection(draft);
                        return;
                    }

                    handleCreateSection(draft);
                }}
            />
        </>
    );
}
