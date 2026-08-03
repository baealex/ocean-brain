import { Link } from '@tanstack/react-router';
import classNames from 'classnames';
import dayjs from 'dayjs';

import type { NotePropertyKeySummary } from '~/apis/note.api';
import * as Icon from '~/components/icon';
import { Button, Text } from '~/components/ui';
import type { Note, NoteProperty, NotePropertyValueType } from '~/models/note.model';
import type { ViewSection, ViewSortBy, ViewSortOrder, ViewTableColumn } from '~/models/view.model';
import { NOTE_ROUTE } from '~/modules/url';
import {
    getViewTableColumnLabel,
    normalizeViewTableColumns,
    normalizeViewTablePropertyKeys,
} from '~/modules/view-dashboard';
import ViewChip from './ViewChip';

interface ViewSectionTableRendererProps {
    section: ViewSection;
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
const SORTABLE_TABLE_COLUMNS: Partial<Record<BaseTableColumn, ViewSortBy>> = {
    title: 'title',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
};
const summaryListClassName = 'flex h-[24px] min-w-0 max-w-full items-center gap-1.5 overflow-hidden whitespace-nowrap';
const emptySummaryClassName = 'text-xs leading-5 text-fg-tertiary';

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

const getColumnWidth = (column: ResolvedTableColumn) =>
    column.kind === 'property' ? getPropertyColumnWidth(column.valueType) : BASE_COLUMN_WIDTHS[column.key];

const resolvePropertyColumns = (
    section: ViewSection,
    notes: Note[],
    availableProperties: NotePropertyKeySummary[],
): Extract<ResolvedTableColumn, { kind: 'property' }>[] => {
    const propertySummaryByKey = new Map(availableProperties.map((property) => [property.key, property]));
    const notePropertyByKey = new Map(
        notes.flatMap((note) => note.properties ?? []).map((property) => [property.key, property]),
    );
    const configuredKeys = normalizeViewTablePropertyKeys(section.displayOptions.tablePropertyKeys);
    const automaticKeys = Array.from(
        new Set([
            ...section.propertyFilters.map((filter) => filter.key),
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
    section: ViewSection,
    notes: Note[],
    availableProperties: NotePropertyKeySummary[],
): ResolvedTableColumn[] => {
    const propertyColumns = resolvePropertyColumns(section, notes, availableProperties);

    return normalizeViewTableColumns(section.displayOptions.tableColumns).reduce<ResolvedTableColumn[]>(
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

const getTableWidth = (columns: ResolvedTableColumn[]) =>
    columns.reduce((totalWidth, column) => totalWidth + getColumnWidth(column), 0);

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

const renderPropertyValue = (property: NoteProperty | undefined) => {
    if (!property) {
        return <span className={emptySummaryClassName}>—</span>;
    }

    if (property.valueType === 'select') {
        return (
            <ViewChip
                size="compact"
                className="max-w-full border-border-subtle bg-subtle/65 text-fg-secondary"
                truncateContent={false}
            >
                <span className="inline-flex min-w-0 items-center gap-2">
                    <span
                        className="size-2 shrink-0 rounded-full border border-black/5"
                        style={{ backgroundColor: property.option?.color ?? 'var(--color-fg-tertiary)' }}
                        aria-hidden="true"
                    />
                    <span className="min-w-0 truncate">{property.option?.label ?? property.value}</span>
                </span>
            </ViewChip>
        );
    }

    if (property.valueType === 'boolean') {
        const isTrue = property.value === 'true';
        const BooleanIcon = isTrue ? Icon.CheckCircle : Icon.Circle;

        return (
            <span className="inline-flex items-center gap-1.5 text-sm text-fg-secondary">
                <BooleanIcon className="size-3.5 text-fg-tertiary" weight={isTrue ? 'fill' : 'regular'} />
                {isTrue ? 'True' : 'False'}
            </span>
        );
    }

    return (
        <span
            className={classNames(
                'block truncate text-sm text-fg-secondary',
                property.valueType === 'number' && 'tabular-nums',
            )}
            title={property.value}
        >
            {property.value || '—'}
        </span>
    );
};

export default function ViewSectionTableRenderer({
    section,
    notes,
    isPending,
    isError,
    onRetry,
    onSortChange,
    isSortPending,
    activeSortBy = section.sortBy,
    activeSortOrder = section.sortOrder,
    availableProperties = [],
    surface = 'flush',
}: ViewSectionTableRendererProps) {
    const columns = resolveTableColumns(section, notes, availableProperties);
    const tableWidth = getTableWidth(columns);
    const surfaceClassName =
        surface === 'card'
            ? 'overflow-x-auto rounded-[16px] border border-border-subtle bg-elevated'
            : 'overflow-x-auto bg-transparent';
    const loadingSurfaceClassName =
        surface === 'card'
            ? 'overflow-hidden rounded-[16px] border border-border-subtle bg-elevated'
            : 'overflow-hidden bg-transparent';
    const loadingRowClassName = surface === 'card' ? 'bg-elevated' : 'bg-transparent';
    const tableHeadClassName = surface === 'card' ? 'bg-subtle/65' : 'bg-subtle/45';
    const tableBodyClassName = surface === 'card' ? 'bg-elevated' : 'bg-transparent';
    const stickyCellBackground = surface === 'card' ? 'var(--elevated)' : 'var(--surface)';

    const renderHeaderCell = (column: ResolvedTableColumn) => {
        if (column.kind === 'property') {
            return (
                <th key={`property:${column.key}`} className="px-3 py-2 text-left">
                    <Text as="p" variant="label" weight="semibold" className="truncate" title={column.name}>
                        {column.name}
                    </Text>
                    <Text as="p" variant="micro" tone="tertiary" className="mt-0.5 capitalize">
                        {column.valueType}
                    </Text>
                </th>
            );
        }

        const sortBy = SORTABLE_TABLE_COLUMNS[column.key];
        const label = getViewTableColumnLabel(column.key);
        const isActiveSort = sortBy ? activeSortBy === sortBy : false;
        const isTitle = column.key === 'title';

        return (
            <th
                key={column.key}
                aria-sort={isActiveSort ? (activeSortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                className={classNames(
                    'px-3 py-2.5 text-xs font-semibold text-fg-tertiary',
                    isTitle && 'lg:sticky lg:left-0 lg:z-20',
                )}
                style={
                    isTitle
                        ? {
                              background: `linear-gradient(var(--subtle), var(--subtle)), ${stickyCellBackground}`,
                          }
                        : undefined
                }
            >
                {sortBy ? (
                    <button
                        type="button"
                        className="focus-ring-soft -ml-1 inline-flex items-center gap-1 rounded-[8px] px-1 py-0.5 outline-none transition-colors hover:bg-hover-subtle hover:text-fg-secondary disabled:cursor-wait disabled:opacity-60"
                        disabled={isSortPending}
                        onClick={() => onSortChange(sortBy)}
                    >
                        <span>{label}</span>
                        <span aria-hidden="true" className="text-[10px] text-fg-tertiary">
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
            return (
                <td
                    key={`property:${column.key}`}
                    className="overflow-hidden px-3 py-2.5 align-middle transition-colors group-hover:bg-hover-subtle"
                >
                    {renderPropertyValue(note.properties?.find((property) => property.key === column.key))}
                </td>
            );
        }

        switch (column.key) {
            case 'tags':
                return (
                    <td
                        key={column.key}
                        className="overflow-hidden px-3 py-2.5 align-middle transition-colors group-hover:bg-hover-subtle"
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
                        className="whitespace-nowrap px-3 py-2.5 align-middle transition-colors group-hover:bg-hover-subtle"
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
                        className="relative px-3 py-2.5 align-middle lg:sticky lg:left-0 lg:z-10"
                        style={{ background: stickyCellBackground }}
                    >
                        <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 bg-hover-subtle opacity-0 transition-opacity group-hover:opacity-100"
                        />
                        <div className="relative z-10 flex min-w-0 items-center gap-2">
                            {note.pinned ? (
                                <Icon.Pin
                                    className="size-3.5 shrink-0 text-fg-tertiary"
                                    weight="fill"
                                    aria-label="Pinned"
                                />
                            ) : null}
                            <Text as="div" variant="body" weight="semibold" className="min-w-0 line-clamp-1">
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
            <div className="rounded-[16px] border border-border-subtle bg-subtle/30 p-4">
                <Text as="p" variant="body" weight="semibold">
                    Failed to load this table
                </Text>
                <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                    Retry to refresh this saved query.
                </Text>
                <div className="mt-3">
                    <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    if (notes.length === 0) {
        return (
            <div className="rounded-[16px] border border-dashed border-border-subtle px-4 py-5">
                <Text as="p" variant="body" weight="semibold">
                    No rows yet
                </Text>
                <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                    Add matching notes, or edit this view query.
                </Text>
            </div>
        );
    }

    return (
        <div
            className={surfaceClassName}
            data-scroll-restoration-id={`view-table-${section.id}`}
            aria-label="Scrollable view table"
        >
            <table className="w-full table-fixed border-collapse text-left" style={{ minWidth: tableWidth }}>
                <caption className="sr-only">View query results as a table</caption>
                <colgroup>
                    {columns.map((column) => (
                        <col
                            key={column.kind === 'property' ? `property:${column.key}` : column.key}
                            style={{
                                width: `${(getColumnWidth(column) / tableWidth) * 100}%`,
                            }}
                        />
                    ))}
                </colgroup>
                <thead className={tableHeadClassName}>
                    <tr className="border-b border-border-subtle">{columns.map(renderHeaderCell)}</tr>
                </thead>
                <tbody className={tableBodyClassName}>
                    {notes.map((note) => (
                        <tr key={note.id} className="group h-12 border-b border-border-subtle/70 last:border-b-0">
                            {columns.map((column) => renderCell(note, column))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
