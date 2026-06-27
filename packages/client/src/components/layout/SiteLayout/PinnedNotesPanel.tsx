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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from '@tanstack/react-router';
import classNames from 'classnames';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useEffect, useState } from 'react';

import { reorderNotes } from '~/apis/note.api';
import { QueryBoundary, QueryErrorView } from '~/components/app';
import { PinnedNotes } from '~/components/entities';
import * as Icon from '~/components/icon';
import { Skeleton } from '~/components/shared';
import { Text } from '~/components/ui';
import type { Note } from '~/models/note.model';
import { queryKeys } from '~/modules/query-key-factory';
import { NOTE_ROUTE } from '~/modules/url';

type PinnedNote = Pick<Note, 'id' | 'title' | 'order'>;
type PinnedNoteOrder = Pick<PinnedNote, 'id' | 'order'>;

interface SortablePinnedNoteProps {
    id: string;
    title?: string;
    isActive?: boolean;
    children: ReactNode;
}

interface PinnedNotesListProps {
    notes: PinnedNote[];
    pathname: string;
    pinnedItems: PinnedNote[];
    setPinnedItems: Dispatch<SetStateAction<PinnedNote[]>>;
    handleDragEnd: (event: DragEndEvent) => void;
    sensors: ReturnType<typeof useSensors>;
}

const dragHandleBaseClassName =
    'focus-ring-soft flex h-8 w-8 items-center justify-center rounded-[10px] text-fg-tertiary opacity-70 outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing touch-none';
const pinnedLinkBaseClassName =
    'focus-ring-soft block truncate rounded-[10px] px-1.5 py-1 outline-none transition-colors';

export const buildPinnedNoteReorderPayload = (
    items: PinnedNote[],
    activeId: string,
    overId: string,
): { nextItems: PinnedNote[]; orders: PinnedNoteOrder[] } | null => {
    if (activeId === overId) {
        return null;
    }

    const oldIndex = items.findIndex((item) => item.id === activeId);
    const newIndex = items.findIndex((item) => item.id === overId);

    if (oldIndex < 0 || newIndex < 0) {
        return null;
    }

    const nextItems = [...items];
    const [movedItem] = nextItems.splice(oldIndex, 1);

    if (!movedItem) {
        return null;
    }

    nextItems.splice(newIndex, 0, movedItem);

    return {
        nextItems,
        orders: nextItems.map((item, index) => ({
            id: item.id,
            order: index,
        })),
    };
};

function SortablePinnedNote({ id, title, isActive = false, children }: SortablePinnedNoteProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={classNames(
                'group flex min-h-[38px] items-center gap-1.5 rounded-[12px] px-1.5 py-1 transition-colors',
                isActive ? 'bg-hover-subtle' : 'hover:bg-hover-subtle/70',
            )}
        >
            <button
                type="button"
                ref={setActivatorNodeRef}
                aria-label={`Reorder note ${title ?? 'Untitled'}`}
                title="Drag to reorder"
                {...attributes}
                {...listeners}
                className={classNames(dragHandleBaseClassName, isDragging ? 'cursor-grabbing' : 'cursor-grab')}
            >
                <Icon.DragHandle className="size-4" />
            </button>
            <Text as="div" truncate variant="meta" weight="medium" className="min-w-0 flex-1">
                {children}
            </Text>
        </div>
    );
}

function PinnedNotesList({
    notes,
    pathname,
    pinnedItems,
    setPinnedItems,
    handleDragEnd,
    sensors,
}: PinnedNotesListProps) {
    useEffect(() => {
        setPinnedItems(notes);
    }, [notes, setPinnedItems]);

    const items = pinnedItems.length > 0 ? pinnedItems : notes;

    if (items.length === 0) {
        return null;
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
        >
            <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                {items.map((note) => (
                    <SortablePinnedNote
                        key={note.id}
                        id={note.id}
                        title={note.title || 'Untitled'}
                        isActive={pathname === `/${note.id}`}
                    >
                        <Link
                            aria-current={pathname === `/${note.id}` ? 'page' : undefined}
                            className={classNames(
                                pinnedLinkBaseClassName,
                                pathname === `/${note.id}`
                                    ? 'text-fg-default'
                                    : 'text-fg-secondary hover:text-fg-default',
                            )}
                            to={NOTE_ROUTE}
                            params={{ id: note.id }}
                        >
                            {note.title || 'Untitled'}
                        </Link>
                    </SortablePinnedNote>
                ))}
            </SortableContext>
        </DndContext>
    );
}

const PinnedNotesPanel = () => {
    const pathname = useLocation({ select: (location) => location.pathname });
    const queryClient = useQueryClient();
    const [pinnedItems, setPinnedItems] = useState<PinnedNote[]>([]);

    const reorderMutation = useMutation({
        mutationFn: reorderNotes,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.notes.pinned(),
                exact: true,
            });
        },
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setPinnedItems((items) => {
                const reorderPayload = buildPinnedNoteReorderPayload(items, String(active.id), String(over.id));

                if (!reorderPayload) {
                    return items;
                }

                reorderMutation.mutate(reorderPayload.orders);

                return reorderPayload.nextItems;
            });
        }
    };

    return (
        <div className="border-l border-border-subtle/70 pl-1.5">
            <QueryBoundary
                fallback={
                    <div className="space-y-1">
                        <Skeleton height="40px" opacity={0.4} />
                        <Skeleton height="40px" opacity={0.4} />
                    </div>
                }
                errorTitle="Failed to load pinned notes"
                errorDescription="Retry loading the pinned note list."
                renderError={({ error, retry }) => (
                    <QueryErrorView
                        title="Failed to load pinned notes"
                        description="Retry loading the pinned note list."
                        error={error}
                        onRetry={retry}
                        showBackAction={false}
                        showHomeAction={false}
                    />
                )}
            >
                <PinnedNotes
                    render={(notes) =>
                        notes.length > 0 ? (
                            <PinnedNotesList
                                notes={notes}
                                pathname={pathname}
                                pinnedItems={pinnedItems}
                                setPinnedItems={setPinnedItems}
                                handleDragEnd={handleDragEnd}
                                sensors={sensors}
                            />
                        ) : (
                            <Text as="div" variant="meta" tone="secondary" className="px-2 py-2.5 leading-6">
                                Pin a note from the note toolbar to keep it here.
                            </Text>
                        )
                    }
                />
            </QueryBoundary>
        </div>
    );
};

export default PinnedNotesPanel;
