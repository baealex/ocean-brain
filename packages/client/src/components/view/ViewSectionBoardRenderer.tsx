import type { DragEndEvent } from '@dnd-kit/core';
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
import { CSS } from '@dnd-kit/utilities';
import { type InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NotePropertyKeySummary } from '~/apis/note.api';
import { updateNoteProperties } from '~/apis/note.api';
import { fetchViewSectionBoardColumn, type ViewBoardColumnResult, type ViewBoardNote } from '~/apis/view.api';
import * as Icon from '~/components/icon';
import { Button, Dropdown, Skeleton } from '~/components/shared';
import { MoreButton, Text, useToast } from '~/components/ui';
import type { NotePropertyOption } from '~/models/note.model';
import type { ViewSection } from '~/models/view.model';
import { queryKeys } from '~/modules/query-key-factory';
import { invalidateQueriesForNoteChange } from '~/modules/server-event-invalidation';
import { timeSince } from '~/modules/time';
import { NOTE_ROUTE } from '~/modules/url';
import type { ViewSectionRouteState, ViewSectionRouteStateUpdater } from '~/modules/view-route-state';

const UNASSIGNED_COLUMN_ID = 'view-board-column:unassigned';

interface BoardColumnDefinition {
    id: string;
    label: string;
    value: string | null;
    color: string | null;
}

interface ViewSectionBoardRendererProps {
    section: ViewSection;
    groupProperty: NotePropertyKeySummary;
    navigationState?: ViewSectionRouteState;
    onNavigationStateChange?: (updater: ViewSectionRouteStateUpdater) => void;
}

interface BoardCardProps {
    note: ViewBoardNote;
    column: BoardColumnDefinition;
    columns: BoardColumnDefinition[];
    isMoving: boolean;
    onMove: (note: ViewBoardNote, sourceValue: string | null, destinationValue: string | null) => void;
}

interface BoardColumnProps {
    section: ViewSection;
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

function BoardCard({ note, column, columns, isMoving, onMove }: BoardCardProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
        id: `view-board-note:${note.id}`,
        data: { note, sourceValue: column.value },
        disabled: isMoving,
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
                    <Text as="p" variant="meta" tone="tertiary" className="mt-2">
                        Updated {timeSince(Number(note.updatedAt))}
                    </Text>
                </div>
                <Dropdown
                    button={<MoreButton label={`Move ${note.title || 'Untitled'}`} size="sm" />}
                    items={columns
                        .filter((candidate) => candidate.value !== column.value)
                        .map((candidate) => ({
                            name: `Move to ${candidate.label}`,
                            onClick: () => onMove(note, column.value, candidate.value),
                        }))}
                />
            </div>
        </article>
    );
}

function BoardColumn({
    section,
    groupProperty,
    column,
    columns,
    index,
    scrollRootRef,
    movingNoteIds,
    onMove,
    pageCount,
    onPageCountChange,
}: BoardColumnProps) {
    const columnElementRef = useRef<HTMLElement | null>(null);
    const [shouldLoad, setShouldLoad] = useState(index < 4);
    const { isOver, setNodeRef } = useDroppable({
        id: column.id,
        data: { optionValue: column.value },
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
            queryKey: queryKeys.views.sectionBoardColumnPages(
                section.id,
                groupProperty.key,
                column.value,
                section.limit,
            ),
            enabled: shouldLoad,
            initialPageParam: 0,
            async queryFn({ pageParam }) {
                const response = await fetchViewSectionBoardColumn(section.id, {
                    optionValue: column.value,
                    limit: section.limit,
                    offset: pageParam,
                });

                if (response.type === 'error') {
                    throw response;
                }

                return response.viewSectionBoardColumn;
            },
            getNextPageParam(lastPage, pages) {
                const loadedCount = pages.reduce((count, page) => count + page.notes.length, 0);
                return loadedCount < lastPage.totalCount ? pages.length * section.limit : undefined;
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

        const lastPageCount = Math.max(1, Math.ceil(totalCount / section.limit));
        if (pageCount > lastPageCount) {
            onPageCountChange(lastPageCount);
        }
    }, [onPageCountChange, pageCount, section.limit, totalCount]);

    const assignColumnRef = (node: HTMLElement | null) => {
        columnElementRef.current = node;
        setNodeRef(node);
    };

    return (
        <section
            ref={assignColumnRef}
            aria-label={`${column.label} column`}
            className={classNames(
                'flex min-h-[248px] w-[17rem] shrink-0 flex-col rounded-[18px] border bg-subtle/30 transition-[border-color,background-color] sm:w-[18rem]',
                isOver ? 'border-accent-primary/50 bg-accent-primary/6' : 'border-border-subtle',
            )}
        >
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle/75 px-3.5 py-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span
                        className="size-2.5 shrink-0 rounded-full border border-black/5"
                        style={{ backgroundColor: column.color ?? 'var(--color-fg-tertiary)' }}
                        aria-hidden="true"
                    />
                    <Text as="h3" variant="label" weight="semibold" className="truncate">
                        {column.label}
                    </Text>
                </div>
                <Text
                    as="span"
                    variant="meta"
                    tone="tertiary"
                    aria-label={totalCount === undefined ? 'Card count loading' : `${totalCount} cards`}
                    className="inline-flex min-w-6 justify-center rounded-full bg-elevated px-2 py-0.5 tabular-nums"
                >
                    {totalCount ?? '–'}
                </Text>
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
                        <Text as="p" variant="meta" tone="tertiary">
                            Failed to load this column.
                        </Text>
                        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => void refetch()}>
                            Retry
                        </Button>
                    </div>
                ) : notes.length === 0 ? (
                    <div className="flex min-h-28 items-center justify-center rounded-[14px] border border-dashed border-border-subtle px-3 text-center">
                        <Text as="p" variant="meta" tone="tertiary">
                            Drop a note here
                        </Text>
                    </div>
                ) : (
                    notes.map((note) => (
                        <BoardCard
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
            </div>
        </section>
    );
}

export default function ViewSectionBoardRenderer({
    section,
    groupProperty,
    navigationState = {},
    onNavigationStateChange = () => undefined,
}: ViewSectionBoardRendererProps) {
    const queryClient = useQueryClient();
    const toast = useToast();
    const scrollRootRef = useRef<HTMLDivElement | null>(null);
    const [movingNoteIds, setMovingNoteIds] = useState<Set<string>>(() => new Set());
    const columns = useMemo(() => getBoardColumns(groupProperty.options), [groupProperty.options]);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor),
    );

    const moveNote = useCallback(
        async (note: ViewBoardNote, sourceValue: string | null, destinationValue: string | null) => {
            if (sourceValue === destinationValue || movingNoteIds.has(note.id)) {
                return;
            }

            setMovingNoteIds((current) => new Set(current).add(note.id));
            const boardQueryPrefix = queryKeys.views.sectionBoardAll(section.id);
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
                const pageSize = queryParams.pageSize ?? section.limit;
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
        [groupProperty.key, groupProperty.name, movingNoteIds, queryClient, section.id, section.limit, toast],
    );

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        const note = active.data.current?.note as ViewBoardNote | undefined;
        const sourceValue = active.data.current?.sourceValue as string | null | undefined;
        const destinationValue = over?.data.current?.optionValue as string | null | undefined;

        if (!note || sourceValue === undefined || destinationValue === undefined) {
            return;
        }

        void moveNote(note, sourceValue, destinationValue);
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div
                ref={scrollRootRef}
                data-scroll-restoration-id={`view-board-${section.id}`}
                className="overflow-x-auto overscroll-x-contain px-3 py-3.5 [scrollbar-gutter:stable] sm:px-4"
                aria-label={`Board grouped by ${groupProperty.name}`}
            >
                <div className="flex min-w-max items-stretch gap-3 pb-1">
                    {columns.map((column, index) => (
                        <BoardColumn
                            key={column.id}
                            section={section}
                            groupProperty={groupProperty}
                            column={column}
                            columns={columns}
                            index={index}
                            scrollRootRef={scrollRootRef}
                            movingNoteIds={movingNoteIds}
                            pageCount={navigationState.columns?.[column.id] ?? 1}
                            onPageCountChange={(pageCount) =>
                                onNavigationStateChange((current) => ({
                                    ...current,
                                    columns: {
                                        ...current.columns,
                                        [column.id]: pageCount,
                                    },
                                }))
                            }
                            onMove={(note, sourceValue, destinationValue) =>
                                void moveNote(note, sourceValue, destinationValue)
                            }
                        />
                    ))}
                </div>
            </div>
        </DndContext>
    );
}
