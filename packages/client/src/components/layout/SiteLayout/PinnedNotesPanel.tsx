import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from '@tanstack/react-router';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { reorderNotes } from '~/apis/note.api';
import { QueryBoundary, QueryErrorView } from '~/components/app';
import { PinnedNotes } from '~/components/entities';
import * as Icon from '~/components/icon';
import { Skeleton } from '~/components/shared';
import { Tooltip } from '~/components/ui';
import type { Note } from '~/models/note.model';
import { queryKeys } from '~/modules/query-key-factory';
import { NOTE_ROUTE } from '~/modules/url';

type PinnedNote = Pick<Note, 'id' | 'title' | 'order'>;

interface SortablePinnedNoteProps {
    id: string;
    tooltip?: string;
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

function SortablePinnedNote({ id, tooltip, children }: SortablePinnedNoteProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    const textContent = (
        <div className="flex-1 min-w-0 font-bold text-sm truncate">
            {children}
        </div>
    );

    return (
        <div ref={setNodeRef} style={style} {...attributes} className="flex items-center gap-2 p-2 rounded-md hover:bg-hover-subtle transition-colors">
            <button
                ref={setActivatorNodeRef}
                {...listeners}
                className="cursor-grab active:cursor-grabbing touch-none flex items-center justify-center"
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
                <Icon.Menu className="size-4 text-fg-placeholder hover:text-fg-secondary" />
            </button>
            {tooltip ? (
                <Tooltip content={tooltip} side="right">
                    {textContent}
                </Tooltip>
            ) : textContent}
        </div>
    );
}

function PinnedNotesList({
    notes,
    pathname,
    pinnedItems,
    setPinnedItems,
    handleDragEnd,
    sensors
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
            modifiers={[restrictToVerticalAxis]}>
            <SortableContext
                items={items.map((item) => item.id)}
                strategy={verticalListSortingStrategy}>
                {items.map((note) => (
                    <SortablePinnedNote key={note.id} id={note.id} tooltip={note.title || 'Untitled'}>
                        <Link
                            className={`transition-colors ${
                                pathname === `/${note.id}`
                                    ? 'text-accent-primary'
                                    : 'text-fg-secondary hover:text-fg-default'
                            }`}
                            to={NOTE_ROUTE}
                            params={{ id: note.id }}>
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
                exact: true
            });
        }
    });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setPinnedItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                const nextItems = arrayMove(items, oldIndex, newIndex);

                reorderMutation.mutate(nextItems.map((item, index) => ({
                    id: item.id,
                    order: index
                })));

                return nextItems;
            });
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <QueryBoundary
                fallback={(
                    <>
                        <Skeleton height="24px" opacity={0.5} />
                        <Skeleton height="24px" opacity={0.5} />
                    </>
                )}
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
                )}>
                <PinnedNotes
                    render={(notes) => (
                        <PinnedNotesList
                            notes={notes}
                            pathname={pathname}
                            pinnedItems={pinnedItems}
                            setPinnedItems={setPinnedItems}
                            handleDragEnd={handleDragEnd}
                            sensors={sensors}
                        />
                    )}
                />
            </QueryBoundary>
        </div>
    );
};

export default PinnedNotesPanel;
