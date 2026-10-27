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
import { getRouteApi } from '@tanstack/react-router';
import classNames from 'classnames';
import { useCallback, useState } from 'react';

import { fetchAllNotePropertyKeys, type NotePropertyKeySummary } from '~/apis/note.api';
import { fetchTags } from '~/apis/tag.api';
import {
    createView,
    createViewGroup,
    deleteView,
    deleteViewGroup,
    fetchViewWorkspace,
    reorderViewGroups,
    reorderViews,
    setActiveViewGroup,
    updateView,
    updateViewGroup,
} from '~/apis/view.api';
import * as Icon from '~/components/icon';
import { Button, Dropdown, Empty, PageLayout, Skeleton, SurfaceCard } from '~/components/shared';
import { MoreButton, Text, useConfirm, useToast } from '~/components/ui';
import { ViewCard, ViewDialog, type ViewDialogDraft, ViewGroupBar, ViewGroupDialog } from '~/components/view';
import type {
    View,
    ViewDisplayOptions,
    ViewGroup,
    ViewSortBy,
    ViewSortOrder,
    ViewsWorkspace,
} from '~/models/view.model';
import { queryKeys } from '~/modules/query-key-factory';
import { VIEWS_ROUTE } from '~/modules/url';
import {
    buildViewInput,
    EMPTY_VIEWS_WORKSPACE,
    getActiveViewGroup,
    moveViewGroupInWorkspace,
    moveViewInWorkspace,
    reorderViewGroupsInWorkspace,
    reorderViewsInWorkspace,
    setActiveViewGroupInWorkspace,
    type ViewMoveDirection,
} from '~/modules/view-dashboard';
import {
    getViewRouteState,
    updateViewRouteState,
    type ViewNavigationState,
    type ViewRouteStateUpdater,
} from '~/modules/view-route-state';

const Route = getRouteApi(VIEWS_ROUTE);

const pageDescription = 'Create saved views with filters and display formats, then organize them into view groups.';

type ViewGroupDialogState = { mode: 'create' } | { mode: 'edit'; group: ViewGroup } | null;
type ViewDialogState = { mode: 'create' } | { mode: 'edit'; view: View } | null;

const dragHandleClassName =
    'focus-ring-soft hidden h-8 w-8 items-center justify-center rounded-[10px] text-fg-default/70 outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default sm:inline-flex touch-none';

interface SortableViewProps {
    view: View;
    availableProperties: NotePropertyKeySummary[];
    isPropertiesLoading: boolean;
    isPropertiesError: boolean;
    onRetryProperties: () => void;
    onEdit: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onSaveSort: (sortBy: ViewSortBy, sortOrder: ViewSortOrder) => Promise<void>;
    onSaveColumns: (options: ViewDisplayOptions) => Promise<boolean>;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    navigationState: ViewNavigationState;
    onNavigationStateChange: (viewId: string, updater: ViewRouteStateUpdater) => void;
}

const SortableView = ({
    view,
    availableProperties,
    isPropertiesLoading,
    isPropertiesError,
    onRetryProperties,
    onEdit,
    onDuplicate,
    onDelete,
    onSaveSort,
    onSaveColumns,
    onMoveUp,
    onMoveDown,
    navigationState,
    onNavigationStateChange,
}: SortableViewProps) => {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: view.id,
    });
    const handleNavigationStateChange = useCallback(
        (updater: ViewRouteStateUpdater) => onNavigationStateChange(view.id, updater),
        [onNavigationStateChange, view.id],
    );

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                transition,
                opacity: isDragging ? 0.6 : 1,
            }}
        >
            <ViewCard
                view={view}
                availableProperties={availableProperties}
                isPropertiesLoading={isPropertiesLoading}
                isPropertiesError={isPropertiesError}
                onRetryProperties={onRetryProperties}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onSaveSort={onSaveSort}
                onSaveColumns={onSaveColumns}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                navigationState={navigationState}
                onNavigationStateChange={handleNavigationStateChange}
                dragHandle={
                    <button
                        type="button"
                        ref={setActivatorNodeRef}
                        aria-label={`Reorder view ${view.title}`}
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
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const [groupDialogState, setGroupDialogState] = useState<ViewGroupDialogState>(null);
    const [viewDialogState, setViewDialogState] = useState<ViewDialogState>(null);

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
    const activeGroup = workspace.groups.find((group) => group.id === search.group) ?? getActiveViewGroup(workspace);
    const activeGroupIndex = activeGroup ? workspace.groups.findIndex((group) => group.id === activeGroup.id) : -1;

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

    const {
        data: propertyKeyData,
        isPending: isPropertiesLoading,
        isError: isPropertiesError,
        refetch: refetchProperties,
    } = useQuery({
        queryKey: queryKeys.notes.propertyKeysCatalog(),
        async queryFn() {
            const response = await fetchAllNotePropertyKeys();

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

    const handleViewNavigationStateChange = useCallback(
        (viewId: string, updater: ViewRouteStateUpdater) => {
            void navigate({
                search: (current) => ({
                    ...current,
                    state: updateViewRouteState(current.state, viewId, updater),
                }),
                replace: true,
                resetScroll: false,
            });
        },
        [navigate],
    );

    const invalidateViews = async () => {
        await queryClient.invalidateQueries({
            queryKey: queryKeys.views.all(),
            exact: false,
        });
    };

    const persistGroupOrder = async (previousWorkspace: ViewsWorkspace, nextWorkspace: ViewsWorkspace) => {
        syncWorkspace(nextWorkspace);

        const response = await reorderViewGroups(nextWorkspace.groups.map((group) => group.id));

        if (response.type === 'error') {
            syncWorkspace(previousWorkspace);
            toast(response.errors[0].message);
            return;
        }

        await invalidateViews();
    };

    const handleGroupDragEnd = async ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) {
            return;
        }

        const previousWorkspace = queryClient.getQueryData<ViewsWorkspace>(queryKeys.views.workspace()) ?? workspace;
        const nextWorkspace = reorderViewGroupsInWorkspace(previousWorkspace, String(active.id), String(over.id));
        await persistGroupOrder(previousWorkspace, nextWorkspace);
    };

    const handleMoveActiveGroup = async (direction: ViewMoveDirection) => {
        if (!activeGroup) {
            return;
        }

        const previousWorkspace = queryClient.getQueryData<ViewsWorkspace>(queryKeys.views.workspace()) ?? workspace;
        const nextWorkspace = moveViewGroupInWorkspace(previousWorkspace, activeGroup.id, direction);

        if (nextWorkspace !== previousWorkspace) {
            await persistGroupOrder(previousWorkspace, nextWorkspace);
        }
    };

    const handleSelectGroup = async (group: ViewGroup) => {
        const previousWorkspace = queryClient.getQueryData<ViewsWorkspace>(queryKeys.views.workspace()) ?? workspace;
        const previousSearch = search;
        const nextWorkspace = setActiveViewGroupInWorkspace(previousWorkspace, group.id);

        syncWorkspace(nextWorkspace);
        await navigate({
            search: { group: group.id, state: undefined },
            resetScroll: false,
        });

        const response = await setActiveViewGroup(group.id);

        if (response.type === 'error') {
            syncWorkspace(previousWorkspace);
            await navigate({ search: previousSearch, replace: true, resetScroll: false });
            toast(response.errors[0].message);
            return;
        }

        syncWorkspace(response.setActiveViewGroup);
    };

    const persistViewOrder = async (previousWorkspace: ViewsWorkspace, nextWorkspace: ViewsWorkspace) => {
        if (!activeGroup) {
            return;
        }

        syncWorkspace(nextWorkspace);

        const response = await reorderViews(
            activeGroup.id,
            nextWorkspace.groups.find((group) => group.id === activeGroup.id)?.views.map((view) => view.id) ?? [],
        );

        if (response.type === 'error') {
            syncWorkspace(previousWorkspace);
            toast(response.errors[0].message);
            return;
        }

        await invalidateViews();
    };

    const handleViewDragEnd = async ({ active, over }: DragEndEvent) => {
        if (!activeGroup || !over || active.id === over.id) {
            return;
        }

        const previousWorkspace = queryClient.getQueryData<ViewsWorkspace>(queryKeys.views.workspace()) ?? workspace;
        const nextWorkspace = reorderViewsInWorkspace(
            previousWorkspace,
            activeGroup.id,
            String(active.id),
            String(over.id),
        );
        await persistViewOrder(previousWorkspace, nextWorkspace);
    };

    const handleMoveView = async (viewId: string, direction: ViewMoveDirection) => {
        if (!activeGroup) {
            return;
        }

        const previousWorkspace = queryClient.getQueryData<ViewsWorkspace>(queryKeys.views.workspace()) ?? workspace;
        const nextWorkspace = moveViewInWorkspace(previousWorkspace, activeGroup.id, viewId, direction);

        if (nextWorkspace !== previousWorkspace) {
            await persistViewOrder(previousWorkspace, nextWorkspace);
        }
    };

    const handleCreateGroup = async (title: string) => {
        const response = await createViewGroup(title);

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        const activeGroupResponse = await setActiveViewGroup(response.createViewGroup.id);
        if (activeGroupResponse.type === 'success') {
            syncWorkspace(activeGroupResponse.setActiveViewGroup);
        } else {
            toast(activeGroupResponse.errors[0].message);
        }

        await invalidateViews();
        await navigate({
            search: { group: response.createViewGroup.id, state: undefined },
            resetScroll: false,
        });
        setGroupDialogState(null);
    };

    const handleUpdateGroup = async (title: string) => {
        if (!activeGroup) {
            return;
        }

        const response = await updateViewGroup(activeGroup.id, title);

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        await invalidateViews();
        setGroupDialogState(null);
    };

    const handleDeleteActiveGroup = async () => {
        if (!activeGroup) {
            return;
        }

        if (!(await confirm('Delete this view group and all of its views?'))) {
            return;
        }

        const response = await deleteViewGroup(activeGroup.id);

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        await invalidateViews();
        await navigate({ search: { group: undefined, state: undefined }, replace: true, resetScroll: false });
    };

    const handleCreateView = async (draft: ViewDialogDraft) => {
        if (!activeGroup) {
            return;
        }

        const response = await createView(activeGroup.id, draft);

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        await invalidateViews();
        setViewDialogState(null);
    };

    const handleUpdateView = async (draft: ViewDialogDraft) => {
        if (!activeGroup || !viewDialogState || viewDialogState.mode !== 'edit') {
            return;
        }

        const response = await updateView(viewDialogState.view.id, draft);

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        handleViewNavigationStateChange(viewDialogState.view.id, {});
        await invalidateViews();
        setViewDialogState(null);
    };

    const handleSaveViewSort = async (view: View, sortBy: ViewSortBy, sortOrder: ViewSortOrder) => {
        try {
            const response = await updateView(view.id, buildViewInput(view, { sortBy, sortOrder }));

            if (response.type === 'error') {
                toast(response.errors[0]?.message ?? 'Failed to save the default sort.');
                return;
            }

            queryClient.setQueryData<ViewsWorkspace>(queryKeys.views.workspace(), (current) =>
                current
                    ? {
                          ...current,
                          groups: current.groups.map((group) => ({
                              ...group,
                              views: group.views.map((candidate) =>
                                  candidate.id === view.id ? { ...candidate, sortBy, sortOrder } : candidate,
                              ),
                          })),
                      }
                    : current,
            );
            handleViewNavigationStateChange(view.id, (current) =>
                current.sort?.by === sortBy && current.sort.order === sortOrder
                    ? { ...current, sort: undefined }
                    : current,
            );
            await invalidateViews();
        } catch {
            toast('Failed to save the default sort.');
        }
    };

    const handleSaveViewColumns = async (view: View, displayOptions: ViewDisplayOptions) => {
        try {
            const response = await updateView(view.id, buildViewInput(view, { displayOptions }));
            if (response.type === 'error') {
                toast(response.errors[0]?.message ?? 'Failed to save the table columns.');
                return false;
            }
            await invalidateViews();
            return true;
        } catch {
            toast('Failed to save the table columns.');
            return false;
        }
    };

    const handleDuplicateView = async (view: View) => {
        const response = await createView(view.groupId, {
            ...buildViewInput(view),
            title: `${view.title} copy`,
        });

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        await invalidateViews();
        toast('View duplicated.');
    };

    const handleDeleteView = async (viewId: string) => {
        if (!activeGroup) {
            return;
        }

        if (!(await confirm('Delete this view from the current group?'))) {
            return;
        }

        const response = await deleteView(viewId);

        if (response.type === 'error') {
            toast(response.errors[0].message);
            return;
        }

        handleViewNavigationStateChange(viewId, {});
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
                            Retry loading your view groups.
                        </Text>
                        <div className="mt-4">
                            <Button type="button" variant="ghost" size="sm" onClick={() => void refetchWorkspace()}>
                                Retry
                            </Button>
                        </div>
                    </SurfaceCard>
                ) : workspace.groups.length === 0 ? (
                    <div className="flex flex-col gap-4">
                        <Empty
                            title="Create your first view group"
                            description="Create a group, then add views that filter notes by tags, properties, or both."
                            className="h-[320px]"
                        />
                        <div className="flex justify-center">
                            <Button type="button" onClick={() => setGroupDialogState({ mode: 'create' })}>
                                <Icon.Plus className="h-4 w-4" />
                                Create first group
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-5">
                        <ViewGroupBar
                            groups={workspace.groups}
                            activeGroupId={activeGroup?.id ?? null}
                            onSelectGroup={handleSelectGroup}
                            onReorderGroups={handleGroupDragEnd}
                            onCreateGroup={() => setGroupDialogState({ mode: 'create' })}
                        />

                        {activeGroup && (
                            <div className="flex flex-col gap-5">
                                <div className="flex flex-col gap-3 border-b border-border-subtle/80 px-1 pb-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <Text as="h2" variant="subheading" weight="semibold" tracking="tight" truncate>
                                            {activeGroup.title}
                                        </Text>
                                        <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                                            {activeGroup.views.length > 0
                                                ? `${activeGroup.views.length} view${activeGroup.views.length === 1 ? '' : 's'} in this group`
                                                : 'Add views to this group'}
                                        </Text>
                                    </div>
                                    <div className="inline-flex flex-wrap items-center gap-2 self-start sm:self-center">
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => setViewDialogState({ mode: 'create' })}
                                        >
                                            <Icon.Plus className="h-4 w-4" />
                                            Add view
                                        </Button>
                                        <Dropdown
                                            button={<MoreButton label="View group actions" />}
                                            items={[
                                                ...(activeGroupIndex > 0
                                                    ? [
                                                          {
                                                              name: 'Move group left',
                                                              onClick: () => void handleMoveActiveGroup('previous'),
                                                          },
                                                      ]
                                                    : []),
                                                ...(activeGroupIndex >= 0 &&
                                                activeGroupIndex < workspace.groups.length - 1
                                                    ? [
                                                          {
                                                              name: 'Move group right',
                                                              onClick: () => void handleMoveActiveGroup('next'),
                                                          },
                                                      ]
                                                    : []),
                                                ...(workspace.groups.length > 1
                                                    ? [{ type: 'separator' as const }]
                                                    : []),
                                                {
                                                    name: 'Rename group',
                                                    onClick: () =>
                                                        setGroupDialogState({ mode: 'edit', group: activeGroup }),
                                                },
                                                { type: 'separator' },
                                                {
                                                    name: 'Delete group',
                                                    onClick: () => void handleDeleteActiveGroup(),
                                                },
                                            ]}
                                        />
                                    </div>
                                </div>

                                {activeGroup.views.length === 0 ? (
                                    <Empty
                                        title="Add the first view to this group"
                                        description="Views filter notes by tags, properties, or both."
                                        className="h-[300px]"
                                    />
                                ) : (
                                    <div className="flex flex-col">
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            modifiers={[restrictToVerticalAxis]}
                                            onDragEnd={handleViewDragEnd}
                                        >
                                            <SortableContext
                                                items={activeGroup.views.map((view) => view.id)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                <div className="flex flex-col gap-4">
                                                    {activeGroup.views.map((view, index) => (
                                                        <SortableView
                                                            key={view.id}
                                                            view={view}
                                                            availableProperties={availableProperties}
                                                            isPropertiesLoading={isPropertiesLoading}
                                                            isPropertiesError={isPropertiesError}
                                                            onRetryProperties={() => void refetchProperties()}
                                                            navigationState={getViewRouteState(search.state, view.id)}
                                                            onNavigationStateChange={handleViewNavigationStateChange}
                                                            onEdit={() => setViewDialogState({ mode: 'edit', view })}
                                                            onDuplicate={() => void handleDuplicateView(view)}
                                                            onDelete={() => void handleDeleteView(view.id)}
                                                            onSaveSort={(sortBy, sortOrder) =>
                                                                handleSaveViewSort(view, sortBy, sortOrder)
                                                            }
                                                            onSaveColumns={(options) =>
                                                                handleSaveViewColumns(view, options)
                                                            }
                                                            onMoveUp={
                                                                index > 0
                                                                    ? () => void handleMoveView(view.id, 'previous')
                                                                    : undefined
                                                            }
                                                            onMoveDown={
                                                                index < activeGroup.views.length - 1
                                                                    ? () => void handleMoveView(view.id, 'next')
                                                                    : undefined
                                                            }
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

            <ViewGroupDialog
                open={groupDialogState !== null}
                mode={groupDialogState?.mode ?? 'create'}
                initialTitle={groupDialogState?.mode === 'edit' ? groupDialogState.group.title : ''}
                onClose={() => setGroupDialogState(null)}
                onSubmit={(title) => {
                    if (groupDialogState?.mode === 'edit') {
                        handleUpdateGroup(title);
                        return;
                    }

                    handleCreateGroup(title);
                }}
            />

            <ViewDialog
                open={viewDialogState !== null}
                mode={viewDialogState?.mode ?? 'create'}
                initialView={viewDialogState?.mode === 'edit' ? viewDialogState.view : null}
                availableTags={availableTags}
                availableProperties={availableProperties}
                isTagsLoading={isTagsLoading}
                isPropertiesLoading={isPropertiesLoading}
                onClose={() => setViewDialogState(null)}
                onSubmit={(draft) => {
                    if (viewDialogState?.mode === 'edit') {
                        handleUpdateView(draft);
                        return;
                    }

                    handleCreateView(draft);
                }}
            />
        </>
    );
}
