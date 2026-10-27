import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    type KeyboardCoordinateGetter,
    KeyboardSensor,
    PointerSensor,
    pointerWithin,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ReactNode } from 'react';

interface VerticalSortableProps {
    items: string[];
    children: ReactNode;
    onDragEnd: (event: DragEndEvent) => void;
}

export default function VerticalSortable({ items, children, onDragEnd }: VerticalSortableProps) {
    const keyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
        const direction = event.code === 'ArrowDown' ? 1 : event.code === 'ArrowUp' ? -1 : 0;
        if (!direction) return;
        event.preventDefault();
        const currentId = context.over?.id ?? context.active?.id;
        const index = items.findIndex((id) => id === currentId);
        const nextId = index >= 0 ? items[index + direction] : undefined;
        const nextRect = nextId ? context.droppableRects.get(nextId) : undefined;
        if (!nextRect || !context.collisionRect) return;

        // Center on the adjacent target so taller items cannot be skipped.
        return {
            x: nextRect.left + (nextRect.width - context.collisionRect.width) / 2,
            y: nextRect.top + (nextRect.height - context.collisionRect.height) / 2,
        };
    };
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
    );

    return (
        <DndContext
            sensors={sensors}
            modifiers={[restrictToVerticalAxis]}
            collisionDetection={(args) => {
                const pointedItems = pointerWithin(args);
                return pointedItems.length > 0 ? pointedItems : closestCenter(args);
            }}
            onDragEnd={onDragEnd}
        >
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
                {children}
            </SortableContext>
        </DndContext>
    );
}
