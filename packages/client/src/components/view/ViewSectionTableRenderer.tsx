import { Link, useNavigate } from '@tanstack/react-router';

import { Button, Text } from '~/components/ui';
import type { Note, NoteProperty } from '~/models/note.model';
import type { ViewSection, ViewSortBy, ViewTableColumn } from '~/models/view.model';
import { timeSince } from '~/modules/time';
import { NOTE_ROUTE } from '~/modules/url';
import { getViewTableColumnLabel, normalizeViewTableColumns } from '~/modules/view-dashboard';
import ViewChip from './ViewChip';

interface ViewSectionTableRendererProps {
    section: ViewSection;
    notes: Note[];
    isPending: boolean;
    isError: boolean;
    onRetry: () => void;
    onSortChange: (sortBy: ViewSortBy) => void;
    isSortPending: boolean;
}

const formatPropertyValue = (property: NoteProperty) => {
    if (property.valueType === 'select') {
        return property.option?.label ?? property.value;
    }

    if (property.valueType === 'boolean') {
        return property.value === 'true' ? 'True' : 'False';
    }

    return property.value;
};

const getVisibleProperties = (note: Note) => (note.properties ?? []).slice(0, 3);
const TABLE_COLUMN_WIDTHS: Record<ViewTableColumn, number> = {
    title: 280,
    tags: 190,
    properties: 260,
    createdAt: 132,
    updatedAt: 132,
};
const SORTABLE_TABLE_COLUMNS: Partial<Record<ViewTableColumn, ViewSortBy>> = {
    title: 'title',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
};
const summaryListClassName = 'flex h-[22px] min-w-0 max-w-full items-center gap-1.5 overflow-hidden whitespace-nowrap';
const emptySummaryClassName = 'text-xs leading-5 text-fg-tertiary';

const getTableMinWidth = (columns: ViewTableColumn[]) => {
    const width = columns.reduce((totalWidth, column) => totalWidth + TABLE_COLUMN_WIDTHS[column], 0);

    return Math.max(520, width);
};

const renderTagSummary = (note: Note, options: { hideEmpty?: boolean } = {}) => {
    if (note.tags.length === 0) {
        if (options.hideEmpty) {
            return null;
        }

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
            {hiddenCount > 0 && (
                <ViewChip size="compact" className="shrink-0 border-border-subtle bg-subtle text-fg-tertiary">
                    +{hiddenCount}
                </ViewChip>
            )}
        </div>
    );
};

const renderPropertySummary = (note: Note, options: { hideEmpty?: boolean } = {}) => {
    const visibleProperties = getVisibleProperties(note);

    if (visibleProperties.length === 0) {
        if (options.hideEmpty) {
            return null;
        }

        return <span className={emptySummaryClassName}>—</span>;
    }

    const hiddenCount = (note.properties?.length ?? 0) - visibleProperties.length;

    return (
        <div className={summaryListClassName}>
            {visibleProperties.map((property) => (
                <ViewChip
                    key={property.key}
                    size="compact"
                    truncateContent={false}
                    className="max-w-[190px] shrink-0 gap-1 border-border-subtle bg-subtle text-fg-secondary"
                >
                    <span className="min-w-0 max-w-[76px] shrink truncate text-fg-tertiary">{property.name}</span>
                    <span className="min-w-0 truncate">{formatPropertyValue(property) || '—'}</span>
                </ViewChip>
            ))}
            {hiddenCount > 0 && (
                <ViewChip size="compact" className="shrink-0 border-border-subtle bg-subtle text-fg-tertiary">
                    +{hiddenCount}
                </ViewChip>
            )}
        </div>
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
}: ViewSectionTableRendererProps) {
    const navigate = useNavigate();
    const visibleColumns = normalizeViewTableColumns(section.displayOptions?.tableColumns);
    const tableMinWidth = getTableMinWidth(visibleColumns);

    const openNote = (noteId: string) => {
        void navigate({
            to: NOTE_ROUTE,
            params: { id: noteId },
        });
    };

    const renderHeaderCell = (column: ViewTableColumn) => {
        const sortBy = SORTABLE_TABLE_COLUMNS[column];
        const label = getViewTableColumnLabel(column);
        const isActiveSort = sortBy ? section.sortBy === sortBy : false;

        return (
            <th
                key={column}
                aria-sort={isActiveSort ? (section.sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                className="px-3 py-2.5 text-xs font-semibold text-fg-tertiary"
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
                            {isActiveSort ? (section.sortOrder === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                    </button>
                ) : (
                    label
                )}
            </th>
        );
    };

    const renderCell = (note: Note, column: ViewTableColumn) => {
        switch (column) {
            case 'tags':
                return (
                    <td key={column} className="overflow-hidden px-3 py-2.5 align-middle">
                        {renderTagSummary(note)}
                    </td>
                );
            case 'properties':
                return (
                    <td key={column} className="overflow-hidden px-3 py-2.5 align-middle">
                        {renderPropertySummary(note)}
                    </td>
                );
            case 'createdAt':
                return (
                    <td key={column} className="whitespace-nowrap px-3 py-2.5 align-middle">
                        <Text as="span" variant="meta" tone="tertiary">
                            {timeSince(Number(note.createdAt))}
                        </Text>
                    </td>
                );
            case 'updatedAt':
                return (
                    <td key={column} className="whitespace-nowrap px-3 py-2.5 align-middle">
                        <Text as="span" variant="meta" tone="tertiary">
                            {timeSince(Number(note.updatedAt))}
                        </Text>
                    </td>
                );
            case 'title':
            default:
                return (
                    <td key={column} className="px-3 py-2.5 align-middle">
                        <Text as="div" variant="body" weight="semibold" className="line-clamp-1">
                            <Link
                                to={NOTE_ROUTE}
                                params={{ id: note.id }}
                                className="focus-ring-soft rounded-[6px] outline-none transition-colors hover:text-fg-default/85"
                                onClick={(event) => event.stopPropagation()}
                            >
                                {note.title || 'Untitled'}
                            </Link>
                        </Text>
                    </td>
                );
        }
    };

    if (isPending) {
        return (
            <div className="overflow-hidden rounded-[16px] border border-border-subtle">
                <div className="h-11 animate-pulse bg-hover-subtle" />
                <div className="h-14 animate-pulse border-t border-border-subtle bg-elevated" />
                <div className="h-14 animate-pulse border-t border-border-subtle bg-elevated" />
                <div className="h-14 animate-pulse border-t border-border-subtle bg-elevated" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="rounded-[16px] border border-border-subtle bg-hover-subtle/70 p-4">
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
        <div className="overflow-x-auto rounded-[16px] border border-border-subtle bg-elevated">
            <table className="w-full table-fixed border-collapse text-left" style={{ minWidth: tableMinWidth }}>
                <caption className="sr-only">View query results as a table</caption>
                <colgroup>
                    {visibleColumns.map((column) => (
                        <col key={column} style={{ width: TABLE_COLUMN_WIDTHS[column] }} />
                    ))}
                </colgroup>
                <thead className="bg-subtle/80">
                    <tr className="border-b border-border-subtle">{visibleColumns.map(renderHeaderCell)}</tr>
                </thead>
                <tbody className="bg-elevated">
                    {notes.map((note) => (
                        <tr
                            key={note.id}
                            className="h-12 cursor-pointer border-b border-border-subtle/70 transition-colors last:border-b-0 hover:bg-hover-subtle"
                            onClick={() => openNote(note.id)}
                        >
                            {visibleColumns.map((column) => renderCell(note, column))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
