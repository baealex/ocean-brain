import type { DragEndEvent } from '@dnd-kit/core';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames';
import { useState } from 'react';

import { fetchNotePropertyKeys } from '~/apis/note.api';
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
import {
    ViewSectionCard,
    ViewSectionDialog,
    type ViewSectionDialogDraft,
    ViewTabBar,
    ViewTabDialog,
} from '~/components/view';
import type { ViewSection, ViewsWorkspace, ViewTab } from '~/models/view.model';
import { queryKeys } from '~/modules/query-key-factory';
import {
    buildViewSectionInput,
    EMPTY_VIEWS_WORKSPACE,
    getActiveViewTab,
    reorderViewSectionsInWorkspace,
    reorderViewTabsInWorkspace,
    setActiveViewTabInWorkspace,
} from '~/modules/view-dashboard';

const pageDescription = 'Save reusable note queries with tags, shared properties, and sorting.';

type ViewTabDialogState = { mode: 'create' } | { mode: 'edit'; tab: ViewTab } | null;
type ViewSectionDialogState = { mode: 'create' } | { mode: 'edit'; section: ViewSection } | null;

const dragHandleClassName =
    'focus-ring-soft hidden h-8 w-8 items-center justify-center rounded-[10px] text-fg-default/70 outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default sm:inline-flex touch-none';

interface SortableViewSectionProps {
    section: ViewSection;
    onEdit: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
}

const SortableViewSection = ({ section, onEdit, onDuplicate, onDelete }: SortableViewSectionProps) => {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: section.id,
    });

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                transition,
                opacity: isDragging ? 0.6 : 1,
            }}
        >
            <ViewSectionCard
                section={section}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
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

    const { data: propertyKeyData, isPending: isPropertiesLoading } = useQuery({
        queryKey: queryKeys.notes.propertyKeys({ limit: 100 }),
        async queryFn() {
            const response = await fetchNotePropertyKeys({ limit: 100 });

            if (response.type === 'error') {
                throw response;
            }

            return response.notePropertyKeys;
        },
    });

    const availableProperties = propertyKeyData?.keys ?? [];

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

    const handleSelectTab = async (tab: ViewTab) => {
        const previousWorkspace = queryClient.getQueryData<ViewsWorkspace>(queryKeys.views.workspace()) ?? workspace;
        const nextWorkspace = setActiveViewTabInWorkspace(previousWorkspace, tab.id);

        syncWorkspace(nextWorkspace);

        const response = await setActiveViewTab(tab.id);

        if (response.type === 'error') {
            syncWorkspace(previousWorkspace);
            toast(response.errors[0].message);
            return;
        }

        syncWorkspace(response.setActiveViewTab);
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

    const handleCreateSection = async (draft: ViewSectionDialogDraft) => {
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

    const handleUpdateSection = async (draft: ViewSectionDialogDraft) => {
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

    const handleDuplicateSection = async (section: ViewSection) => {
        const response = await createViewSection(section.tabId, {
            ...buildViewSectionInput(section),
            title: `${section.title} copy`,
        });

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        await invalidateViews();
        toast('Section duplicated.');
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
                    <div className="flex flex-col gap-4">
                        <Empty
                            title="Create your first view tab"
                            description="Start with a saved view tab, then add sections that query notes by tags, properties, or both."
                            className="h-[320px]"
                        />
                        <div className="flex justify-center">
                            <Button type="button" onClick={() => setTabDialogState({ mode: 'create' })}>
                                <Icon.Plus className="h-4 w-4" />
                                Create first tab
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-5">
                        <ViewTabBar
                            tabs={workspace.tabs}
                            activeTabId={activeTab?.id ?? null}
                            onSelectTab={handleSelectTab}
                            onReorderTabs={handleTabDragEnd}
                            onCreateTab={() => setTabDialogState({ mode: 'create' })}
                        />

                        {activeTab && (
                            <div className="flex flex-col gap-5">
                                <div className="flex flex-col gap-3 border-b border-border-subtle/80 px-1 pb-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <Text as="h2" variant="subheading" weight="semibold" tracking="tight" truncate>
                                            {activeTab.title}
                                        </Text>
                                        <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                                            {activeTab.sections.length > 0
                                                ? `${activeTab.sections.length} section${activeTab.sections.length === 1 ? '' : 's'} in this view`
                                                : 'Add sections to build this view'}
                                        </Text>
                                    </div>
                                    <div className="inline-flex flex-wrap items-center gap-2 self-start sm:self-center">
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
                                                    name: 'Rename tab',
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
                                </div>

                                {activeTab.sections.length === 0 ? (
                                    <Empty
                                        title="Add the first section to this tab"
                                        description="Sections can pull notes by tags, properties, or both."
                                        className="h-[300px]"
                                    />
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
                                                            onDuplicate={() => void handleDuplicateSection(section)}
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
                availableProperties={availableProperties}
                isTagsLoading={isTagsLoading}
                isPropertiesLoading={isPropertiesLoading}
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
