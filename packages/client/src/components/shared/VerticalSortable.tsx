import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    type KeyboardCoordinateGetter,
    KeyboardSensor,
    MouseSensor,
    PointerSensor,
    pointerWithin,
    TouchSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { type ReactNode, useEffect, useRef } from 'react';

interface VerticalSortableProps {
    items: string[];
    children: ReactNode;
    longPressOnTouch?: boolean;
    restrictToList?: boolean;
    onDragEnd: (event: DragEndEvent) => void;
}

export default function VerticalSortable({
    items,
    children,
    longPressOnTouch = false,
    restrictToList = false,
    onDragEnd,
}: VerticalSortableProps) {
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
    const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 6 } });
    const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 6 } });
    const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } });
    const keyboardSensor = useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates });
    const sensors = useSensors(
        longPressOnTouch ? null : pointerSensor,
        longPressOnTouch ? mouseSensor : null,
        longPressOnTouch ? touchSensor : null,
        keyboardSensor,
    );
    const preventDropClick = useRef((event: MouseEvent) => event.preventDefault()).current;
    const allowClicksAfterDrop = () =>
        window.setTimeout(() => window.removeEventListener('click', preventDropClick, true), 50);

    useEffect(() => () => window.removeEventListener('click', preventDropClick, true), [preventDropClick]);

    return (
        <DndContext
            sensors={sensors}
            modifiers={restrictToList ? [restrictToVerticalAxis, restrictToParentElement] : [restrictToVerticalAxis]}
            collisionDetection={(args) => {
                const pointedItems = pointerWithin(args);
                return pointedItems.length > 0 ? pointedItems : closestCenter(args);
            }}
            onDragStart={() => window.addEventListener('click', preventDropClick, true)}
            onDragEnd={(event) => {
                allowClicksAfterDrop();
                onDragEnd(event);
            }}
            onDragCancel={allowClicksAfterDrop}
        >
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
                {children}
            </SortableContext>
        </DndContext>
    );
}
