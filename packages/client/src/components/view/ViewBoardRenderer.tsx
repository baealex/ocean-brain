import type { CollisionDetection, DragEndEvent, DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NotePropertyKeySummary } from '~/apis/note.api';
import { updateNoteProperties, updateNotePropertyKey } from '~/apis/note.api';
import { fetchViewBoardColumn, type ViewBoardColumnResult, type ViewBoardNote } from '~/apis/view.api';
import * as Icon from '~/components/icon';
import { Button, Dropdown, Skeleton } from '~/components/shared';
import { MoreButton, Text, useToast } from '~/components/ui';
import type { NotePropertyOption } from '~/models/note.model';
import type { View } from '~/models/view.model';
import { queryKeys } from '~/modules/query-key-factory';
import { invalidateQueriesForNoteChange } from '~/modules/server-event-invalidation';
import { NOTE_ROUTE } from '~/modules/url';
import type { ViewNavigationState, ViewRouteStateUpdater } from '~/modules/view-route-state';
import ViewBoardCardFields from './ViewBoardCardFields';
import ViewNoteCreateButton from './ViewNoteCreateButton';

const UNASSIGNED_COLUMN_ID = 'view-board-column:unassigned';

interface BoardColumnDefinition {
    id: string;
    label: string;
    value: string | null;
    color: string | null;
}

interface ViewBoardRendererProps {
    readOnly?: boolean;
    view: View;
    groupProperty: NotePropertyKeySummary;
    navigationState?: ViewNavigationState;
    onNavigationStateChange?: (updater: ViewRouteStateUpdater) => void;
}

interface BoardCardProps {
    readOnly: boolean;
    view: View;
    note: ViewBoardNote;
    column: BoardColumnDefinition;
    columns: BoardColumnDefinition[];
    isMoving: boolean;
    onMove: (note: ViewBoardNote, sourceValue: string | null, destinationValue: string | null) => void;
}

interface BoardColumnSortable {
    setNodeRef: (node: HTMLElement | null) => void;
    setActivatorNodeRef: (node: HTMLElement | null) => void;
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
    style: React.CSSProperties;
    isDragging: boolean;
    moveItems: { name: string; onClick: () => void }[];
}

interface BoardColumnProps {
    readOnly: boolean;
    sortable?: BoardColumnSortable;
    view: View;
    groupProperty: NotePropertyKeySummary;
    column: BoardColumnDefinition;
    columns: BoardColumnDefinition[];
    index: number;
    scrollRootRef: React.RefObject<HTMLDivElement | null>;
    movingNoteIds: Set<string>;
    onMove: BoardCardProps['onMove'];
    pageCount: number;
    onPageCountChange: (pageCount: number) => void;
}

const getColumnId = (value: string | null) =>
    value === null ? UNASSIGNED_COLUMN_ID : `view-board-column:value:${encodeURIComponent(value)}`;

const getColumnSortId = (value: string) => `view-board-column-sort:${encodeURIComponent(value)}`;

const isColumnDrag = (data: Record<string, unknown> | undefined) => data?.type === 'column';

const boardCollisionDetection: CollisionDetection = (args) => {
    const draggingColumn = isColumnDrag(args.active.data.current);

    return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
            (container) => isColumnDrag(container.data.current) === draggingColumn,
        ),
    });
};

const applyColumnOrder = (columns: BoardColumnDefinition[], order: string[] | null) => {
    if (!order) {
        return columns;
    }

    const columnByValue = new Map(columns.map((column) => [column.value, column]));
    const orderedColumns = order.flatMap((value) => {
        const column = columnByValue.get(value);
        return column ? [column] : [];
    });

    return [...orderedColumns, ...columns.filter((column) => !orderedColumns.includes(column))];
};

const getBoardColumns = (options: NotePropertyOption[]): BoardColumnDefinition[] => [
    ...[...options]
        .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label))
        .map((option) => ({
            id: getColumnId(option.value),
            label: option.label,
            value: option.value,
            color: option.color ?? null,
        })),
    {
        id: UNASSIGNED_COLUMN_ID,
        label: 'Unassigned',
        value: null,
        color: null,
    },
];

const BoardCard = ({ view, note, column, columns, isMoving, onMove, readOnly }: BoardCardProps) => {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
        id: `view-board-note:${note.id}`,
        data: { type: 'card', note, sourceValue: column.value },
        disabled: isMoving || readOnly,
    });

    return (
        <article
            ref={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform) }}
            className={classNames(
                'group rounded-[14px] border border-border-subtle bg-elevated px-3 py-2.5 transition-[opacity,background-color,border-color] hover:border-border-secondary/80 hover:bg-hover-subtle/35',
                (isDragging || isMoving) && 'opacity-55',
                isDragging && 'z-20 border-accent-primary/45 bg-elevated ring-2 ring-accent-primary/10',
            )}
        >
            <div className="flex items-start gap-2">
                {!readOnly ? (
                    <button
                        type="button"
                        ref={setActivatorNodeRef}
                        aria-label={`Drag ${note.title || 'Untitled'} to another column`}
                        {...attributes}
                        {...listeners}
                        className="focus-ring-soft mt-0.5 hidden size-7 shrink-0 touch-none items-center justify-center rounded-[9px] text-fg-tertiary outline-none hover:bg-hover-subtle hover:text-fg-default sm:inline-flex"
                    >
                        <Icon.DragHandle className="size-3.5" />
                    </button>
                ) : null}
                <div className="min-w-0 flex-1">
                    <Text as="div" variant="body" weight="semibold" tracking="tight" className="leading-[1.4]">
                        <Link
                            to={NOTE_ROUTE}
                            params={{ id: note.id }}
                            className="line-clamp-2 transition-colors hover:text-fg-default/80"
                        >
                            {note.title || 'Untitled'}
                        </Link>
                    </Text>
                    <ViewBoardCardFields view={view} note={note} />
                </div>
                {!readOnly ? (
                    <Dropdown
                        button={<MoreButton label={`Move ${note.title || 'Untitled'}`} size="sm" />}
                        items={columns
                            .filter((candidate) => candidate.value !== column.value)
                            .map((candidate) => ({
                                name: `Move to ${candidate.label}`,
                                onClick: () => onMove(note, column.value, candidate.value),
                            }))}
                    />
                ) : null}
            </div>
        </article>
    );
};

const BoardColumn = ({
    readOnly,
    sortable,
    view,
    groupProperty,
    column,
    columns,
    index,
    scrollRootRef,
    movingNoteIds,
    onMove,
    pageCount,
    onPageCountChange,
}: BoardColumnProps) => {
    const columnElementRef = useRef<HTMLElement | null>(null);
    const [shouldLoad, setShouldLoad] = useState(index < 4);
    const { isOver, setNodeRef } = useDroppable({
        disabled: readOnly,
        id: column.id,
        data: { type: 'card-target', optionValue: column.value },
    });

    useEffect(() => {
        if (shouldLoad || !columnElementRef.current) {
            return;
        }

        if (typeof IntersectionObserver === 'undefined') {
            setShouldLoad(true);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setShouldLoad(true);
                    observer.disconnect();
                }
            },
            {
                root: scrollRootRef.current,
                rootMargin: '0px 320px',
                threshold: 0.01,
            },
        );

        observer.observe(columnElementRef.current);
        return () => observer.disconnect();
    }, [scrollRootRef, shouldLoad]);

    const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } =
        useInfiniteQuery({
            queryKey: queryKeys.views.viewBoardColumnPages(view.id, groupProperty.key, column.value, view.limit),
            enabled: shouldLoad,
            initialPageParam: 0,
            async queryFn({ pageParam }) {
                const response = await fetchViewBoardColumn(view.id, {
                    optionValue: column.value,
                    limit: view.limit,
                    offset: pageParam,
                });

                if (response.type === 'error') {
                    throw response;
                }

                return response.viewBoardColumn;
            },
            getNextPageParam(lastPage, pages) {
                const loadedCount = pages.reduce((count, page) => count + page.notes.length, 0);
                return loadedCount < lastPage.totalCount ? pages.length * view.limit : undefined;
            },
        });

    const notes = useMemo(
        () =>
            Array.from(
                new Map((data?.pages ?? []).flatMap((page) => page.notes).map((note) => [note.id, note])).values(),
            ),
        [data?.pages],
    );
    const totalCount = data?.pages[0]?.totalCount;

    useEffect(() => {
        if (
            !shouldLoad ||
            !data ||
            data.pages.length >= pageCount ||
            !hasNextPage ||
            isFetchingNextPage ||
            isFetchNextPageError
        ) {
            return;
        }

        void fetchNextPage();
    }, [data, fetchNextPage, hasNextPage, isFetchNextPageError, isFetchingNextPage, pageCount, shouldLoad]);

    useEffect(() => {
        if (totalCount === undefined) {
            return;
        }

        const lastPageCount = Math.max(1, Math.ceil(totalCount / view.limit));
        if (pageCount > lastPageCount) {
            onPageCountChange(lastPageCount);
        }
    }, [onPageCountChange, pageCount, view.limit, totalCount]);

    const assignColumnRef = (node: HTMLElement | null) => {
        columnElementRef.current = node;
        setNodeRef(node);
        sortable?.setNodeRef(node);
    };

    return (
        <section
            ref={assignColumnRef}
            style={sortable?.style}
            aria-label={`${column.label} column`}
            className={classNames(
                'flex min-h-[248px] w-[17rem] shrink-0 flex-col rounded-[18px] border bg-subtle/30 transition-[border-color,background-color] sm:w-[18rem]',
                sortable?.isDragging && 'relative z-20 opacity-70',
                isOver ? 'border-accent-primary/50 bg-accent-primary/6' : 'border-border-subtle',
            )}
        >
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle/75 px-3.5 py-3">
                <div className="flex min-w-0 items-center gap-2">
                    {sortable ? (
                        <button
                            type="button"
                            ref={sortable.setActivatorNodeRef}
                            {...sortable.attributes}
                            {...sortable.listeners}
                            aria-label={`Reorder ${column.label} column`}
                            className="focus-ring-soft -ml-1.5 hidden size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-[9px] text-fg-tertiary outline-none hover:bg-hover-subtle hover:text-fg-default active:cursor-grabbing sm:inline-flex"
                        >
                            <Icon.DragHandle className="size-3.5" />
                        </button>
                    ) : null}
                    <span
                        className="size-2.5 shrink-0 rounded-full border border-black/5"
                        style={{ backgroundColor: column.color ?? 'var(--color-fg-tertiary)' }}
                        aria-hidden="true"
                    />
                    <Text as="h3" variant="label" weight="semibold" className="truncate">
                        {column.label}
                    </Text>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Text
                        as="span"
                        variant="meta"
                        tone="tertiary"
                        aria-label={totalCount === undefined ? 'Card count loading' : `${totalCount} cards`}
                        className="inline-flex min-w-6 justify-center rounded-full bg-elevated px-2 py-0.5 tabular-nums"
                    >
                        {totalCount ?? '–'}
                    </Text>
                    {sortable && sortable.moveItems.length > 0 ? (
                        <Dropdown
                            button={<MoreButton label={`Actions for ${column.label} column`} size="sm" />}
                            items={sortable.moveItems}
                        />
                    ) : null}
                </div>
            </div>

            <div className="flex flex-1 flex-col gap-2 p-2.5">
                {!shouldLoad ? (
                    <button
                        type="button"
                        className="focus-ring-soft flex min-h-28 items-center justify-center rounded-[14px] border border-dashed border-border-subtle px-3 text-sm text-fg-tertiary outline-none hover:bg-elevated"
                        onClick={() => setShouldLoad(true)}
                    >
                        Load cards
                    </button>
                ) : isPending && !data ? (
                    <>
                        <Skeleton height="76px" className="rounded-[14px]" />
                        <Skeleton height="76px" className="rounded-[14px]" />
                    </>
                ) : isError ? (
                    <div className="rounded-[14px] border border-dashed border-border-subtle bg-elevated/60 p-3">
                        <Text as="p" variant="meta" tone="error">
                            Failed to load this column.
                        </Text>
                        <Button
                            type="button"
                            variant="subtle"
                            size="sm"
                            className="mt-2"
                            onClick={() => void refetch()}
                        >
                            Retry
                        </Button>
                    </div>
                ) : notes.length === 0 ? (
                    <div className="flex min-h-28 items-center justify-center rounded-[14px] border border-dashed border-border-subtle px-3 text-center">
                        <Text as="p" variant="meta" tone="tertiary">
                            {readOnly ? 'No matching notes' : 'Drop a note here'}
                        </Text>
                    </div>
                ) : (
                    notes.map((note) => (
                        <BoardCard
                            readOnly={readOnly}
                            view={view}
                            key={note.id}
                            note={note}
                            column={column}
                            columns={columns}
                            isMoving={movingNoteIds.has(note.id)}
                            onMove={onMove}
                        />
                    ))
                )}

                {hasNextPage ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-auto w-full"
                        disabled={isFetchingNextPage}
                        onClick={() => {
                            if (!isFetchNextPageError) {
                                onPageCountChange(pageCount + 1);
                            }
                            void fetchNextPage();
                        }}
                    >
                        {isFetchingNextPage
                            ? 'Loading...'
                            : isFetchNextPageError
                              ? 'Retry loading cards'
                              : `Load more (${Math.max(0, (totalCount ?? 0) - notes.length)})`}
                    </Button>
                ) : null}
                {!readOnly ? (
                    <ViewNoteCreateButton
                        viewId={view.id}
                        groupValue={column.value}
                        label={`New note in ${column.label}`}
                    />
                ) : null}
            </div>
        </section>
    );
};

interface SortableBoardColumnProps extends Omit<BoardColumnProps, 'sortable'> {
    optionIndex: number;
    optionCount: number;
    onReorder: (from: number, to: number) => void;
}

const SortableBoardColumn = ({ optionIndex, optionCount, onReorder, ...columnProps }: SortableBoardColumnProps) => {
    const optionValue = columnProps.column.value ?? '';
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: getColumnSortId(optionValue),
        data: { type: 'column', optionValue },
    });

    return (
        <BoardColumn
            {...columnProps}
            sortable={{
                setNodeRef,
                setActivatorNodeRef,
                attributes,
                listeners,
                style: { transform: CSS.Translate.toString(transform), transition },
                isDragging,
                moveItems: [
                    ...(optionIndex > 0
                        ? [{ name: 'Move left', onClick: () => onReorder(optionIndex, optionIndex - 1) }]
                        : []),
                    ...(optionIndex < optionCount - 1
                        ? [{ name: 'Move right', onClick: () => onReorder(optionIndex, optionIndex + 1) }]
                        : []),
                ],
            }}
        />
    );
};

const ViewBoardRenderer = ({
    readOnly = false,
    view,
    groupProperty,
    navigationState = {},
    onNavigationStateChange = () => undefined,
}: ViewBoardRendererProps) => {
    const queryClient = useQueryClient();
    const toast = useToast();
    const scrollRootRef = useRef<HTMLDivElement | null>(null);
    const [movingNoteIds, setMovingNoteIds] = useState<Set<string>>(() => new Set());
    const [pendingColumnOrder, setPendingColumnOrder] = useState<string[] | null>(null);
    const columns = useMemo(
        () => applyColumnOrder(getBoardColumns(groupProperty.options), pendingColumnOrder),
        [groupProperty.options, pendingColumnOrder],
    );
    const optionColumns = columns.filter((column) => column.value !== null);

    useEffect(() => {
        setPendingColumnOrder(null);
    }, [groupProperty.options]);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor),
    );

    const moveNote = useCallback(
        async (note: ViewBoardNote, sourceValue: string | null, destinationValue: string | null) => {
            if (readOnly || sourceValue === destinationValue || movingNoteIds.has(note.id)) {
                return;
            }

            setMovingNoteIds((current) => new Set(current).add(note.id));
            const boardQueryPrefix = queryKeys.views.viewBoardAll(view.id);
            const snapshots = queryClient.getQueriesData<InfiniteData<ViewBoardColumnResult, number>>({
                queryKey: boardQueryPrefix,
            });

            for (const [queryKey, cachedColumn] of snapshots) {
                if (!cachedColumn || !Array.isArray(cachedColumn.pages)) {
                    continue;
                }

                const queryParams = queryKey[3] as
                    | { groupPropertyKey?: string; optionValue?: string | null; pageSize?: number }
                    | undefined;

                if (queryParams?.groupPropertyKey !== groupProperty.key) {
                    continue;
                }

                const isSource = queryParams.optionValue === sourceValue;
                const isDestination = queryParams.optionValue === destinationValue;
                const pageSize = queryParams.pageSize ?? view.limit;
                let nextNotes = cachedColumn.pages
                    .flatMap((page) => page.notes)
                    .filter((candidate) => candidate.id !== note.id);

                if (isDestination) {
                    nextNotes = [note, ...nextNotes];
                }

                const nextTotalCount = Math.max(
                    0,
                    (cachedColumn.pages[0]?.totalCount ?? 0) - (isSource ? 1 : 0) + (isDestination ? 1 : 0),
                );

                queryClient.setQueryData<InfiniteData<ViewBoardColumnResult, number>>(queryKey, {
                    ...cachedColumn,
                    pages: cachedColumn.pages.map((_page, pageIndex) => ({
                        totalCount: nextTotalCount,
                        notes: nextNotes.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
                    })),
                });
            }

            try {
                const response = await updateNoteProperties({
                    id: note.id,
                    expectedUpdatedAt: note.updatedAt,
                    ...(destinationValue === null
                        ? { deleteKeys: [groupProperty.key] }
                        : {
                              set: [
                                  {
                                      key: groupProperty.key,
                                      name: groupProperty.name,
                                      value: destinationValue,
                                      valueType: 'select',
                                  },
                              ],
                          }),
                });

                if (response.type === 'error') {
                    for (const [queryKey, snapshot] of snapshots) {
                        queryClient.setQueryData(queryKey, snapshot);
                    }
                    toast(response.errors[0]?.message ?? 'Failed to move this note.');
                    return;
                }

                await Promise.all([
                    invalidateQueriesForNoteChange(queryClient),
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.notes.propertyKeysAll(),
                        exact: false,
                    }),
                ]);
            } catch {
                for (const [queryKey, snapshot] of snapshots) {
                    queryClient.setQueryData(queryKey, snapshot);
                }
                toast('Failed to move this note.');
            } finally {
                setMovingNoteIds((current) => {
                    const next = new Set(current);
                    next.delete(note.id);
                    return next;
                });
            }
        },
        [groupProperty.key, groupProperty.name, movingNoteIds, queryClient, readOnly, view.id, view.limit, toast],
    );

    const reorderColumns = async (from: number, to: number) => {
        if (readOnly || from === to || from < 0 || to < 0 || to >= optionColumns.length) {
            return;
        }

        const nextValues = arrayMove(
            optionColumns.map((column) => column.value ?? ''),
            from,
            to,
        );
        const optionByValue = new Map(groupProperty.options.map((option) => [option.value, option]));
        setPendingColumnOrder(nextValues);

        try {
            const response = await updateNotePropertyKey({
                key: groupProperty.key,
                options: nextValues.flatMap((value, order) => {
                    const option = optionByValue.get(value);
                    return option
                        ? [
                              {
                                  id: option.id,
                                  label: option.label,
                                  value: option.value,
                                  color: option.color ?? null,
                                  order,
                              },
                          ]
                        : [];
                }),
            });

            if (response.type === 'error') {
                setPendingColumnOrder(null);
                toast(response.errors[0]?.message ?? 'Failed to reorder columns.');
                return;
            }

            await queryClient.invalidateQueries({ queryKey: queryKeys.notes.propertyKeysAll(), exact: false });
            toast(`Saved the ${groupProperty.name} order. Every view using it follows this order.`);
        } catch {
            setPendingColumnOrder(null);
            toast('Failed to reorder columns.');
        }
    };

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (isColumnDrag(active.data.current)) {
            const optionValues = optionColumns.map((column) => column.value);
            void reorderColumns(
                optionValues.indexOf(active.data.current?.optionValue as string),
                optionValues.indexOf(over?.data.current?.optionValue as string),
            );
            return;
        }

        const note = active.data.current?.note as ViewBoardNote | undefined;
        const sourceValue = active.data.current?.sourceValue as string | null | undefined;
        const destinationValue = over?.data.current?.optionValue as string | null | undefined;

        if (!note || sourceValue === undefined || destinationValue === undefined) {
            return;
        }

        void moveNote(note, sourceValue, destinationValue);
    };

    return (
        <DndContext sensors={sensors} collisionDetection={boardCollisionDetection} onDragEnd={handleDragEnd}>
            <div
                ref={scrollRootRef}
                data-scroll-restoration-id={`view-board-${view.id}`}
                className="overflow-x-auto overscroll-x-contain px-3 py-3.5 [scrollbar-gutter:stable] sm:px-4"
                aria-label={`Board grouped by ${groupProperty.name}`}
            >
                <div className="flex min-w-max items-stretch gap-3 pb-1">
                    <SortableContext
                        items={optionColumns.map((column) => getColumnSortId(column.value ?? ''))}
                        strategy={horizontalListSortingStrategy}
                    >
                        {columns.map((column, index) => {
                            const columnProps = {
                                readOnly,
                                view,
                                groupProperty,
                                column,
                                columns,
                                index,
                                scrollRootRef,
                                movingNoteIds,
                                pageCount: navigationState.columns?.[column.id] ?? 1,
                                onPageCountChange: (pageCount: number) =>
                                    onNavigationStateChange((current) => ({
                                        ...current,
                                        columns: {
                                            ...current.columns,
                                            [column.id]: pageCount,
                                        },
                                    })),
                                onMove: (
                                    note: ViewBoardNote,
                                    sourceValue: string | null,
                                    destinationValue: string | null,
                                ) => void moveNote(note, sourceValue, destinationValue),
                            };

                            return readOnly || column.value === null ? (
                                <BoardColumn key={column.id} {...columnProps} />
                            ) : (
                                <SortableBoardColumn
                                    key={column.id}
                                    {...columnProps}
                                    optionIndex={index}
                                    optionCount={optionColumns.length}
                                    onReorder={(from, to) => void reorderColumns(from, to)}
                                />
                            );
                        })}
                    </SortableContext>
                </div>
            </div>
        </DndContext>
    );
};

export default ViewBoardRenderer;
