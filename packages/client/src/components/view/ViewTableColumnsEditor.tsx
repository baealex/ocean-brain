import { arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import classNames from 'classnames';
import { type ReactNode, useId } from 'react';
import type { NotePropertyKeySummary } from '~/apis/note.api';
import * as Icon from '~/components/icon';
import { VerticalSortable } from '~/components/shared';
import { Checkbox, Dropdown, MoreButton, Text, ToggleGroup, ToggleGroupItem } from '~/components/ui';
import type { ViewTableColumn } from '~/models/view.model';
import {
    DEFAULT_VIEW_TABLE_COLUMNS,
    getViewTableColumnLabel,
    MAX_VIEW_TABLE_PROPERTY_COLUMNS,
} from '~/modules/view-dashboard';

interface ColumnItem {
    id: string;
    label: string;
    required?: boolean;
    children?: ReactNode;
}

interface ColumnListProps {
    label: string;
    items: ColumnItem[];
    onMove: (from: number, to: number) => void;
    onHide: (id: string) => void;
}

function SortableColumn({
    item,
    index,
    count,
    onMove,
    onHide,
}: {
    item: ColumnItem;
    index: number;
    count: number;
    onMove: ColumnListProps['onMove'];
    onHide: ColumnListProps['onHide'];
}) {
    const inputId = useId();
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: item.id,
    });
    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform), transition }}
            className={classNames('relative', isDragging && 'z-10 bg-elevated opacity-70')}
        >
            <div className="flex min-h-11 items-center gap-2 px-2">
                <button
                    type="button"
                    ref={setActivatorNodeRef}
                    {...attributes}
                    {...listeners}
                    aria-label={`Reorder ${item.label} column`}
                    className="focus-ring-soft flex size-11 shrink-0 touch-none items-center justify-center rounded-[10px] text-fg-tertiary outline-none hover:bg-hover-subtle cursor-grab active:cursor-grabbing sm:size-9"
                >
                    <Icon.DragHandle className="size-4" />
                </button>
                <Checkbox
                    id={inputId}
                    size="sm"
                    checked
                    disabled={item.required}
                    aria-label={`Show ${item.label} column`}
                    onChange={() => onHide(item.id)}
                />
                <label htmlFor={inputId} className="min-w-0 flex-1 truncate text-sm text-fg-secondary">
                    {item.label}
                </label>
                {count > 1 || !item.required ? (
                    <Dropdown
                        button={<MoreButton label={`Actions for ${item.label} column`} size="sm" />}
                        items={[
                            ...(index > 0 ? [{ name: 'Move up', onClick: () => onMove(index, index - 1) }] : []),
                            ...(index < count - 1
                                ? [{ name: 'Move down', onClick: () => onMove(index, index + 1) }]
                                : []),
                            ...(!item.required ? [{ name: 'Hide column', onClick: () => onHide(item.id) }] : []),
                        ]}
                    />
                ) : null}
            </div>
            {item.children}
        </li>
    );
}

function ColumnList({ label, items, onMove, onHide }: ColumnListProps) {
    return (
        <VerticalSortable
            items={items.map((item) => item.id)}
            onDragEnd={({ active, over }) => {
                if (!over || active.id === over.id) return;
                const from = items.findIndex((item) => item.id === active.id);
                const to = items.findIndex((item) => item.id === over.id);
                if (from >= 0 && to >= 0) onMove(from, to);
            }}
        >
            <ul
                aria-label={label}
                className="divide-y divide-border-subtle rounded-[12px] border border-border-subtle bg-elevated"
            >
                {items.map((item, index) => (
                    <SortableColumn
                        key={item.id}
                        item={item}
                        index={index}
                        count={items.length}
                        onMove={onMove}
                        onHide={onHide}
                    />
                ))}
            </ul>
        </VerticalSortable>
    );
}

function HiddenColumn({ label, disabled, onShow }: { label: string; disabled?: boolean; onShow: () => void }) {
    const inputId = useId();
    return (
        <div className="flex min-h-11 items-center gap-2 px-3">
            <Checkbox
                id={inputId}
                size="sm"
                checked={false}
                disabled={disabled}
                aria-label={`Show ${label} column`}
                onChange={onShow}
            />
            <label htmlFor={inputId} className="min-w-0 flex-1 truncate text-sm text-fg-secondary">
                {label}
            </label>
        </div>
    );
}

export interface ViewTableColumnsEditorProps {
    columns: ViewTableColumn[];
    propertyKeys: string[];
    availableProperties: NotePropertyKeySummary[];
    onColumnsChange: (columns: ViewTableColumn[]) => void;
    onPropertyKeysChange: (keys: string[]) => void;
}

export default function ViewTableColumnsEditor({
    columns,
    propertyKeys,
    availableProperties,
    onColumnsChange,
    onPropertyKeysChange,
}: ViewTableColumnsEditorProps) {
    const propertyByKey = new Map(availableProperties.map((property) => [property.key, property]));
    const previewColumns = columns.flatMap((column) =>
        column === 'properties'
            ? propertyKeys.length > 0
                ? propertyKeys.map((key) => propertyByKey.get(key)?.name ?? key)
                : ['Auto properties']
            : [getViewTableColumnLabel(column)],
    );
    const hiddenColumns = DEFAULT_VIEW_TABLE_COLUMNS.filter((column) => !columns.includes(column));
    const hiddenProperties = availableProperties.filter((property) => !propertyKeys.includes(property.key));
    const propertyEditor = (
        <div className="mx-3 mb-3 border-l border-border-subtle pl-3">
            <ToggleGroup
                type="single"
                value={propertyKeys.length > 0 ? 'choose' : 'auto'}
                variant="quiet"
                size="sm"
                aria-label="Property column selection"
                onValueChange={(value) => {
                    if (value === 'auto') onPropertyKeysChange([]);
                    if (value === 'choose' && propertyKeys.length === 0)
                        onPropertyKeysChange(availableProperties.slice(0, 3).map((property) => property.key));
                }}
            >
                <ToggleGroupItem value="auto">Automatic</ToggleGroupItem>
                <ToggleGroupItem value="choose" disabled={availableProperties.length === 0}>
                    Choose columns
                </ToggleGroupItem>
            </ToggleGroup>
            {propertyKeys.length === 0 ? (
                <Text as="p" variant="meta" tone="tertiary" className="mt-2">
                    Shows up to three properties relevant to the notes.
                </Text>
            ) : (
                <div className="mt-3 flex flex-col gap-2">
                    <ColumnList
                        label="Selected property columns"
                        items={propertyKeys.map((key) => ({ id: key, label: propertyByKey.get(key)?.name ?? key }))}
                        onMove={(from, to) => onPropertyKeysChange(arrayMove(propertyKeys, from, to))}
                        onHide={(key) => onPropertyKeysChange(propertyKeys.filter((candidate) => candidate !== key))}
                    />
                    {hiddenProperties.length > 0 ? (
                        <div>
                            <Text as="p" variant="meta" tone="tertiary" className="px-3 pt-1">
                                Available properties · {propertyKeys.length}/{MAX_VIEW_TABLE_PROPERTY_COLUMNS} selected
                            </Text>
                            {hiddenProperties.map((property) => (
                                <HiddenColumn
                                    key={property.key}
                                    label={property.name}
                                    disabled={propertyKeys.length >= MAX_VIEW_TABLE_PROPERTY_COLUMNS}
                                    onShow={() => onPropertyKeysChange([...propertyKeys, property.key])}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );

    return (
        <div className="flex flex-col gap-3">
            <div>
                <Text as="p" variant="meta" tone="tertiary">
                    Left to right
                </Text>
                <ol aria-label="Column order preview" className="mt-2 flex gap-1 overflow-x-auto pb-1">
                    {previewColumns.map((label, index) => (
                        <li
                            key={`${index}-${label}`}
                            className="shrink-0 rounded-[8px] border border-border-subtle bg-subtle px-2.5 py-1.5 text-xs text-fg-secondary"
                        >
                            {label}
                        </li>
                    ))}
                </ol>
            </div>
            <Text as="p" variant="meta" tone="tertiary">
                Drag to reorder. The title column is always visible.
            </Text>
            <ColumnList
                label="Visible table columns"
                items={columns.map((column) => ({
                    id: column,
                    label: getViewTableColumnLabel(column),
                    required: column === 'title',
                    children: column === 'properties' ? propertyEditor : undefined,
                }))}
                onMove={(from, to) => onColumnsChange(arrayMove(columns, from, to))}
                onHide={(column) => onColumnsChange(columns.filter((candidate) => candidate !== column))}
            />
            {hiddenColumns.length > 0 ? (
                <div>
                    <Text as="p" variant="meta" tone="tertiary" className="px-3">
                        Hidden columns
                    </Text>
                    {hiddenColumns.map((column) => (
                        <HiddenColumn
                            key={column}
                            label={getViewTableColumnLabel(column)}
                            onShow={() => onColumnsChange([...columns, column])}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}
