import { Link } from '@tanstack/react-router';
import classNames from 'classnames';
import dayjs from 'dayjs';
import { type MouseEvent, useCallback, useState } from 'react';

import type { NotePropertyKeySummary } from '~/apis/note.api';
import * as Icon from '~/components/icon';
import { Button, Text } from '~/components/ui';
import type { Note, NotePropertyValueType } from '~/models/note.model';
import type { View, ViewSortBy, ViewSortOrder, ViewTableColumn } from '~/models/view.model';
import { NOTE_ROUTE } from '~/modules/url';
import {
    getViewTableColumnLabel,
    normalizeViewTableColumns,
    normalizeViewTablePropertyKeys,
} from '~/modules/view-dashboard';
import ViewChip from './ViewChip';
import ViewPropertyValue from './ViewPropertyValue';
import ViewTablePropertyCell from './ViewTablePropertyCell';

interface ViewTableRendererProps {
    compact?: boolean;
    readOnly?: boolean;
    view: View;
    notes: Note[];
    isPending: boolean;
    isError: boolean;
    onRetry: () => void;
    onSortChange: (sortBy: ViewSortBy) => void;
    isSortPending: boolean;
    activeSortBy?: ViewSortBy;
    activeSortOrder?: ViewSortOrder;
    availableProperties?: NotePropertyKeySummary[];
    surface?: 'flush' | 'card';
}

type BaseTableColumn = Exclude<ViewTableColumn, 'properties'>;

type ResolvedTableColumn =
    | { kind: 'base'; key: BaseTableColumn }
    | {
          kind: 'property';
          key: string;
          name: string;
          valueType: NotePropertyValueType;
      };

const BASE_COLUMN_WIDTHS: Record<BaseTableColumn, number> = {
    title: 300,
    tags: 200,
    createdAt: 148,
    updatedAt: 148,
};
// The title column stays pinned while scrolling, so it narrows on phones to leave room for the other columns.
const TITLE_COLUMN_WIDTH_VARIABLE = '--view-table-title-width';
const titleColumnWidthClassName = '[--view-table-title-width:168px] sm:[--view-table-title-width:300px]';
const compactTitleColumnWidthClassName = '[--view-table-title-width:152px] sm:[--view-table-title-width:240px]';
const SORTABLE_TABLE_COLUMNS: Partial<Record<BaseTableColumn, ViewSortBy>> = {
    title: 'title',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
};
const summaryListClassName = 'flex h-[24px] min-w-0 max-w-full items-center gap-1.5 overflow-hidden whitespace-nowrap';
const emptySummaryClassName = 'text-xs leading-5 text-fg-tertiary';

// The editor's table handles must not treat view rows as editable document cells.
const stopEditorTableEvent = (event: MouseEvent<HTMLDivElement>) => event.stopPropagation();

const formatTimestamp = (value: string) => dayjs(Number(value)).format('MMM D, YYYY');

const getPropertyColumnWidth = (valueType: NotePropertyValueType) => {
    if (valueType === 'text' || valueType === 'url') {
        return 220;
    }

    if (valueType === 'date') {
        return 168;
    }

    return 156;
};

const COMPACT_BASE_COLUMN_WIDTHS: Record<BaseTableColumn, number> = {
    title: 240,
    tags: 160,
    createdAt: 128,
    updatedAt: 128,
};
const getColumnWidth = (column: ResolvedTableColumn, compact = false) => {
    if (column.kind === 'property') {
        const width = getPropertyColumnWidth(column.valueType);
        return compact ? Math.min(width, 168) : width;
    }
    return (compact ? COMPACT_BASE_COLUMN_WIDTHS : BASE_COLUMN_WIDTHS)[column.key];
};

const isTitleColumn = (column: ResolvedTableColumn) => column.kind === 'base' && column.key === 'title';

const getColumnWidthStyle = (column: ResolvedTableColumn, compact = false) =>
    isTitleColumn(column) ? `var(${TITLE_COLUMN_WIDTH_VARIABLE})` : `${getColumnWidth(column, compact)}px`;

const formatPropertyValueType = (valueType: NotePropertyValueType) =>
    valueType === 'url' ? 'URL' : `${valueType.charAt(0).toUpperCase()}${valueType.slice(1)}`;

const resolvePropertyColumns = (
    view: View,
    notes: Note[],
    availableProperties: NotePropertyKeySummary[],
): Extract<ResolvedTableColumn, { kind: 'property' }>[] => {
    const propertySummaryByKey = new Map(availableProperties.map((property) => [property.key, property]));
    const notePropertyByKey = new Map(
        notes.flatMap((note) => note.properties ?? []).map((property) => [property.key, property]),
    );
    const configuredKeys = normalizeViewTablePropertyKeys(view.displayOptions.tablePropertyKeys);
    const automaticKeys = Array.from(
        new Set([
            ...view.propertyFilters.map((filter) => filter.key),
            ...notes.flatMap((note) => (note.properties ?? []).map((property) => property.key)),
        ]),
    ).slice(0, 3);

    return (configuredKeys.length > 0 ? configuredKeys : automaticKeys).flatMap((key) => {
        const summary = propertySummaryByKey.get(key);
        const noteProperty = notePropertyByKey.get(key);

        if (!summary && !noteProperty) {
            return [];
        }

        return [
            {
                kind: 'property' as const,
                key,
                name: summary?.name ?? noteProperty?.name ?? key,
                valueType: summary?.valueType ?? noteProperty?.valueType ?? 'text',
            },
        ];
    });
};

const resolveTableColumns = (
    view: View,
    notes: Note[],
    availableProperties: NotePropertyKeySummary[],
): ResolvedTableColumn[] => {
    const propertyColumns = resolvePropertyColumns(view, notes, availableProperties);

    return normalizeViewTableColumns(view.displayOptions.tableColumns).reduce<ResolvedTableColumn[]>(
        (resolvedColumns, column) => {
            if (column === 'properties') {
                resolvedColumns.push(...propertyColumns);
            } else {
                resolvedColumns.push({ kind: 'base', key: column });
            }

            return resolvedColumns;
        },
        [],
    );
};

const getTableWidthStyle = (columns: ResolvedTableColumn[], compact = false) => {
    const fixedWidth = columns
        .filter((column) => !isTitleColumn(column))
        .reduce((totalWidth, column) => totalWidth + getColumnWidth(column, compact), 0);
    return columns.some(isTitleColumn)
        ? `calc(${fixedWidth}px + var(${TITLE_COLUMN_WIDTH_VARIABLE}))`
        : `${fixedWidth}px`;
};

interface ScrollEdges {
    start: boolean;
    end: boolean;
}

const useHorizontalScrollEdges = () => {
    const [edges, setEdges] = useState<ScrollEdges>({ start: false, end: false });
    const observeScrollEdges = useCallback((element: HTMLDivElement | null) => {
        if (!element) {
            return;
        }

        const updateEdges = () => {
            const maxScrollLeft = element.scrollWidth - element.clientWidth;
            const nextEdges = { start: element.scrollLeft > 1, end: element.scrollLeft < maxScrollLeft - 1 };
            setEdges((current) =>
                current.start === nextEdges.start && current.end === nextEdges.end ? current : nextEdges,
            );
        };

        updateEdges();
        element.addEventListener('scroll', updateEdges, { passive: true });
        const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(updateEdges) : null;
        resizeObserver?.observe(element);
        if (element.firstElementChild) {
            resizeObserver?.observe(element.firstElementChild);
        }

        return () => {
            element.removeEventListener('scroll', updateEdges);
            resizeObserver?.disconnect();
        };
    }, []);

    return { edges, observeScrollEdges };
};

const renderTagSummary = (note: Note) => {
    if (note.tags.length === 0) {
        return <span className={emptySummaryClassName}>—</span>;
    }

    const visibleTags = note.tags.slice(0, 3);
    const hiddenCount = note.tags.length - visibleTags.length;

    return (
        <div className={summaryListClassName}>
            {visibleTags.map((tag) => (
                <ViewChip
                    key={tag.id}
                    size="compact"
                    className="max-w-[132px] shrink-0 border-border-subtle bg-transparent text-fg-secondary"
                >
                    {tag.name}
                </ViewChip>
            ))}
            {hiddenCount > 0 ? (
                <ViewChip size="compact" className="shrink-0 border-border-subtle bg-subtle text-fg-tertiary">
                    +{hiddenCount}
                </ViewChip>
            ) : null}
        </div>
    );
};

const ViewTableRenderer = ({
    view,
    notes,
    isPending,
    isError,
    onRetry,
    onSortChange,
    isSortPending,
    activeSortBy = view.sortBy,
    activeSortOrder = view.sortOrder,
    availableProperties = [],
    surface = 'flush',
    compact = false,
    readOnly = false,
}: ViewTableRendererProps) => {
    const { edges: scrollEdges, observeScrollEdges } = useHorizontalScrollEdges();
    const columns = resolveTableColumns(view, notes, availableProperties);
    const isTitlePinned = columns[0] ? isTitleColumn(columns[0]) : false;
    const cellPadding = compact ? 'px-2 py-1.5' : 'px-3 py-2.5';
    const surfaceClassName =
        surface === 'card'
            ? 'relative overflow-hidden rounded-[16px] border border-border-subtle bg-elevated'
            : 'relative bg-transparent';
    const loadingSurfaceClassName =
        surface === 'card'
            ? 'overflow-hidden rounded-[16px] border border-border-subtle bg-elevated'
            : 'overflow-hidden bg-transparent';
    const loadingRowClassName = surface === 'card' ? 'bg-elevated' : 'bg-transparent';
    const tableHeadClassName = compact ? 'bg-transparent' : surface === 'card' ? 'bg-subtle/65' : 'bg-subtle/45';
    const tableBodyClassName = surface === 'card' ? 'bg-elevated' : 'bg-transparent';
    const stickyCellBackground = surface === 'card' ? 'var(--elevated)' : 'var(--surface)';
    // Separates the pinned title column from cells scrolled underneath it.
    const pinnedEdgeClassName =
        scrollEdges.start && 'shadow-[inset_-1px_0_0_var(--border-subtle),8px_0_10px_-8px_rgb(0_0_0/0.22)]';
    const headerCellClassName = classNames(
        'text-left text-xs text-fg-secondary',
        cellPadding,
        compact ? 'font-medium' : 'font-semibold',
    );

    const renderHeaderCell = (column: ResolvedTableColumn) => {
        if (column.kind === 'property') {
            return (
                <th key={`property:${column.key}`} className={headerCellClassName}>
                    <span
                        className="block truncate"
                        title={`${column.name} · ${formatPropertyValueType(column.valueType)} property`}
                    >
                        {column.name}
                    </span>
                </th>
            );
        }

        const sortBy = SORTABLE_TABLE_COLUMNS[column.key];
        const label = getViewTableColumnLabel(column.key);
        const isActiveSort = sortBy ? activeSortBy === sortBy : false;
        const isTitle = column.key === 'title' && isTitlePinned;

        return (
            <th
                key={column.key}
                aria-sort={isActiveSort ? (activeSortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                className={classNames(
                    headerCellClassName,
                    isActiveSort && '!text-fg-default',
                    isTitle && ['sticky left-0 z-20', pinnedEdgeClassName],
                )}
                style={
                    isTitle
                        ? {
                              background: compact
                                  ? stickyCellBackground
                                  : `linear-gradient(var(--subtle), var(--subtle)), ${stickyCellBackground}`,
                          }
                        : undefined
                }
            >
                {sortBy ? (
                    <button
                        type="button"
                        className="focus-ring-soft -ml-1 inline-flex items-center gap-1 rounded-[8px] px-1 py-0.5 outline-none transition-colors hover:bg-hover-subtle hover:text-fg-default disabled:cursor-wait disabled:opacity-60"
                        disabled={isSortPending}
                        onClick={() => onSortChange(sortBy)}
                    >
                        <span>{label}</span>
                        <span
                            aria-hidden="true"
                            className={classNames('text-[10px]', !isActiveSort && 'text-fg-tertiary')}
                        >
                            {isActiveSort ? (activeSortOrder === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                    </button>
                ) : (
                    label
                )}
            </th>
        );
    };

    const renderCell = (note: Note, column: ResolvedTableColumn) => {
        if (column.kind === 'property') {
            const definition = availableProperties.find((property) => property.key === column.key);
            return (
                <td
                    key={`property:${column.key}`}
                    className={classNames(
                        'overflow-hidden align-middle transition-colors group-hover:bg-hover-subtle',
                        cellPadding,
                    )}
                >
                    {definition && !readOnly ? (
                        <ViewTablePropertyCell note={note} definition={definition} />
                    ) : (
                        <ViewPropertyValue
                            property={note.properties?.find((property) => property.key === column.key)}
                        />
                    )}
                </td>
            );
        }

        switch (column.key) {
            case 'tags':
                return (
                    <td
                        key={column.key}
                        className={classNames(
                            'overflow-hidden align-middle transition-colors group-hover:bg-hover-subtle',
                            cellPadding,
                        )}
                    >
                        {renderTagSummary(note)}
                    </td>
                );
            case 'createdAt':
            case 'updatedAt': {
                const value = column.key === 'createdAt' ? note.createdAt : note.updatedAt;
                return (
                    <td
                        key={column.key}
                        className={classNames(
                            'whitespace-nowrap align-middle transition-colors group-hover:bg-hover-subtle',
                            cellPadding,
                        )}
                    >
                        <Text
                            as="span"
                            variant="meta"
                            tone="tertiary"
                            title={dayjs(Number(value)).format('MMM D, YYYY h:mm A')}
                        >
                            {formatTimestamp(value)}
                        </Text>
                    </td>
                );
            }
            case 'title':
            default:
                return (
                    <td
                        key={column.key}
                        className={classNames(
                            'relative align-middle',
                            cellPadding,
                            isTitlePinned && ['sticky left-0 z-10', pinnedEdgeClassName],
                        )}
                        style={{ background: stickyCellBackground }}
                    >
                        <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 bg-hover-subtle opacity-0 transition-opacity group-hover:opacity-100"
                        />
                        <div className="relative z-10 flex min-w-0 items-center gap-2">
                            {compact ? (
                                <Icon.FileNote className="size-3.5 shrink-0 text-fg-tertiary" aria-hidden="true" />
                            ) : null}
                            {note.pinned ? (
                                <Icon.Pin
                                    className="size-3.5 shrink-0 text-fg-tertiary"
                                    weight="fill"
                                    aria-label="Pinned"
                                />
                            ) : null}
                            <Text
                                as="div"
                                variant="body"
                                weight={compact ? 'medium' : 'semibold'}
                                className={classNames(
                                    'min-w-0',
                                    compact ? 'line-clamp-1' : 'line-clamp-2 sm:line-clamp-1',
                                )}
                            >
                                <Link
                                    to={NOTE_ROUTE}
                                    params={{ id: note.id }}
                                    className="focus-ring-soft rounded-[6px] outline-none transition-colors hover:text-fg-default/80"
                                >
                                    {note.title || 'Untitled'}
                                </Link>
                            </Text>
                        </div>
                    </td>
                );
        }
    };

    if (isPending) {
        return (
            <div className={loadingSurfaceClassName}>
                <div className="h-11 animate-pulse bg-subtle/50" />
                <div className={`h-14 animate-pulse border-t border-border-subtle ${loadingRowClassName}`} />
                <div className={`h-14 animate-pulse border-t border-border-subtle ${loadingRowClassName}`} />
                <div className={`h-14 animate-pulse border-t border-border-subtle ${loadingRowClassName}`} />
            </div>
        );
    }

    if (isError) {
        return (
            <div className={compact ? 'px-2 py-3' : 'rounded-[16px] border border-border-subtle bg-subtle/30 p-4'}>
                <Text as="p" variant="body" weight="semibold">
                    Failed to load this table
                </Text>
                <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                    Retry to refresh this saved query.
                </Text>
                <div className="mt-3">
                    <Button type="button" variant="subtle" size="sm" onClick={onRetry}>
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    if (notes.length === 0) {
        return (
            <div
                className={compact ? 'px-2 py-3' : 'rounded-[16px] border border-dashed border-border-subtle px-4 py-5'}
            >
                <Text as="p" variant="body" weight="semibold">
                    No rows yet
                </Text>
                <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                    Add matching notes, or edit this view query.
                </Text>
            </div>
        );
    }

    // Fades the clipped edge so columns beyond the visible width read as scrollable content.
    const renderScrollFade = (side: 'left' | 'right', isVisible: boolean) => (
        <div
            aria-hidden="true"
            className={classNames(
                'pointer-events-none absolute inset-y-0 z-30 w-16 transition-opacity duration-200',
                side === 'left'
                    ? 'left-0 shadow-[inset_10px_0_10px_-10px_rgb(0_0_0/0.22)]'
                    : 'right-0 shadow-[inset_-10px_0_10px_-10px_rgb(0_0_0/0.22)]',
                isVisible ? 'opacity-100' : 'opacity-0',
            )}
            style={{ background: `linear-gradient(to ${side}, transparent, ${stickyCellBackground} 80%)` }}
        />
    );

    return (
        <div
            className={classNames(
                surfaceClassName,
                compact ? compactTitleColumnWidthClassName : titleColumnWidthClassName,
            )}
        >
            <div
                ref={observeScrollEdges}
                className="overflow-x-auto"
                data-scroll-restoration-id={`view-table-${view.id}`}
                aria-label="Scrollable view table"
                onMouseDownCapture={stopEditorTableEvent}
                onMouseMoveCapture={stopEditorTableEvent}
                onMouseUpCapture={stopEditorTableEvent}
            >
                <table
                    className="min-w-full table-fixed border-collapse text-left"
                    style={{ width: getTableWidthStyle(columns, compact) }}
                >
                    <caption className="sr-only">View query results as a table</caption>
                    <colgroup>
                        {columns.map((column) => (
                            <col
                                key={column.kind === 'property' ? `property:${column.key}` : column.key}
                                style={{ width: getColumnWidthStyle(column, compact) }}
                            />
                        ))}
                    </colgroup>
                    <thead className={tableHeadClassName}>
                        <tr className="border-b border-border-subtle">{columns.map(renderHeaderCell)}</tr>
                    </thead>
                    <tbody className={tableBodyClassName}>
                        {notes.map((note) => (
                            <tr
                                key={note.id}
                                className={classNames(
                                    'group border-b border-border-subtle/70 last:border-b-0',
                                    compact ? 'h-9' : 'h-12',
                                )}
                            >
                                {columns.map((column) => renderCell(note, column))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {isTitlePinned ? null : renderScrollFade('left', scrollEdges.start)}
            {renderScrollFade('right', scrollEdges.end)}
        </div>
    );
};

export default ViewTableRenderer;
