import { useEffect, useMemo, useState } from 'react';
import type { NotePropertyKeySummary } from '~/apis/note.api';
import { ModalActionRow } from '~/components/shared';
import {
    Button,
    Checkbox,
    Input,
    Label,
    Modal,
    Select,
    SelectItem,
    Text,
    Textarea,
    ToggleGroup,
    ToggleGroupItem,
} from '~/components/ui';
import type { Tag } from '~/models/tag.model';
import type {
    ViewDisplayOptions,
    ViewDisplayType,
    ViewPropertyFilter,
    ViewPropertyFilterOperator,
    ViewSection,
    ViewSortBy,
    ViewSortOrder,
    ViewTableColumn,
    ViewTagMatchMode,
} from '~/models/view.model';
import {
    DEFAULT_VIEW_TABLE_COLUMNS,
    getViewDisplayTypeLabel,
    getViewPropertyOperatorLabel,
    getViewTableColumnLabel,
    getViewTagMatchLabel,
    normalizeViewDisplayOptions,
    normalizeViewTableColumns,
    normalizeViewTagNames,
} from '~/modules/view-dashboard';

export interface ViewSectionDialogDraft {
    title: string;
    displayType: ViewDisplayType;
    displayOptions: ViewDisplayOptions;
    tagNames: string[];
    mode: ViewTagMatchMode;
    propertyFilters: Array<Pick<ViewPropertyFilter, 'key' | 'valueType' | 'operator' | 'value'>>;
    sortBy: ViewSortBy;
    sortOrder: ViewSortOrder;
    limit: number;
}

interface PropertyFilterDraft {
    id: string;
    key: string;
    operator: ViewPropertyFilterOperator;
    value: string;
}

interface ViewSectionDialogProps {
    open: boolean;
    mode: 'create' | 'edit';
    initialSection?: ViewSection | null;
    availableTags: Pick<Tag, 'id' | 'name'>[];
    availableProperties: NotePropertyKeySummary[];
    isTagsLoading?: boolean;
    isPropertiesLoading?: boolean;
    onClose: () => void;
    onSubmit: (draft: ViewSectionDialogDraft) => void;
}

const PROPERTY_PLACEHOLDER_VALUE = '__choose_property__';
const TABLE_COLUMN_OPTIONS: ViewTableColumn[] = ['title', 'tags', 'properties', 'createdAt', 'updatedAt'];

const getInitialLimitValue = (section?: ViewSection | null) => String(section?.limit ?? 5);
const getInitialDisplayTypeValue = (section?: ViewSection | null): ViewDisplayType => {
    if (section?.displayType === 'table') {
        return 'table';
    }

    return 'list';
};
const getInitialTableColumnsValue = (section?: ViewSection | null): ViewTableColumn[] =>
    normalizeViewTableColumns(section?.displayOptions?.tableColumns ?? DEFAULT_VIEW_TABLE_COLUMNS);
const getInitialModeValue = (section?: ViewSection | null): ViewTagMatchMode => section?.mode ?? 'and';
const getInitialTagsValue = (section?: ViewSection | null) => (section ? section.tagNames.join(', ') : '');
const getInitialTitleValue = (section?: ViewSection | null) => section?.title ?? '';
const getInitialSortByValue = (section?: ViewSection | null): ViewSortBy => section?.sortBy ?? 'updatedAt';
const getInitialSortOrderValue = (section?: ViewSection | null): ViewSortOrder => section?.sortOrder ?? 'desc';

const createFilterId = (index: number) => `property-filter-${Date.now()}-${index}`;

const toFilterDrafts = (section?: ViewSection | null): PropertyFilterDraft[] => {
    return (section?.propertyFilters ?? []).map((filter, index) => ({
        id: createFilterId(index),
        key: filter.key,
        operator: filter.operator,
        value: filter.value ?? '',
    }));
};

const getOperatorsForProperty = (property?: NotePropertyKeySummary): ViewPropertyFilterOperator[] => {
    if (!property) {
        return ['exists', 'notExists'];
    }

    if (property.valueType === 'date' || property.valueType === 'number') {
        return ['equals', 'notEquals', 'before', 'after', 'exists', 'notExists'];
    }

    if (property.valueType === 'text' || property.valueType === 'url') {
        return ['equals', 'notEquals', 'contains', 'notContains', 'exists', 'notExists'];
    }

    return ['equals', 'notEquals', 'exists', 'notExists'];
};

const getDefaultOperator = (property?: NotePropertyKeySummary): ViewPropertyFilterOperator => {
    return property ? 'equals' : 'exists';
};

const getDefaultValue = (property?: NotePropertyKeySummary) => {
    if (!property) {
        return '';
    }

    if (property.valueType === 'boolean') {
        return 'true';
    }

    if (property.valueType === 'select') {
        return property.options[0]?.value ?? '';
    }

    return '';
};

const shouldShowFilterValue = (operator: ViewPropertyFilterOperator) =>
    operator !== 'exists' && operator !== 'notExists';

const isSearchTextOperator = (operator: ViewPropertyFilterOperator) =>
    operator === 'contains' || operator === 'notContains';

const getFilterInputType = (property: NotePropertyKeySummary, operator: ViewPropertyFilterOperator) => {
    if (property.valueType === 'date') {
        return 'date';
    }

    if (property.valueType === 'number') {
        return 'number';
    }

    if (property.valueType === 'url' && !isSearchTextOperator(operator)) {
        return 'url';
    }

    return 'text';
};

const getFilterInputPlaceholder = (property: NotePropertyKeySummary, operator: ViewPropertyFilterOperator) => {
    if (property.valueType === 'url') {
        return isSearchTextOperator(operator) ? 'example.com' : 'https://example.com';
    }

    if (property.valueType === 'text') {
        return 'Value';
    }

    return undefined;
};

export default function ViewSectionDialog({
    open,
    mode,
    initialSection = null,
    availableTags,
    availableProperties,
    isTagsLoading = false,
    isPropertiesLoading = false,
    onClose,
    onSubmit,
}: ViewSectionDialogProps) {
    const [title, setTitle] = useState(getInitialTitleValue(initialSection));
    const [displayType, setDisplayType] = useState<ViewDisplayType>(getInitialDisplayTypeValue(initialSection));
    const [tableColumns, setTableColumns] = useState<ViewTableColumn[]>(getInitialTableColumnsValue(initialSection));
    const [tagInput, setTagInput] = useState(getInitialTagsValue(initialSection));
    const [matchMode, setMatchMode] = useState<ViewTagMatchMode>(getInitialModeValue(initialSection));
    const [sortBy, setSortBy] = useState<ViewSortBy>(getInitialSortByValue(initialSection));
    const [sortOrder, setSortOrder] = useState<ViewSortOrder>(getInitialSortOrderValue(initialSection));
    const [limit, setLimit] = useState(getInitialLimitValue(initialSection));
    const [filters, setFilters] = useState<PropertyFilterDraft[]>(toFilterDrafts(initialSection));
    const [isTagFilterOpen, setIsTagFilterOpen] = useState((initialSection?.tagNames.length ?? 0) > 0);
    const [formError, setFormError] = useState('');

    const propertyByKey = useMemo(
        () => new Map(availableProperties.map((property) => [property.key, property])),
        [availableProperties],
    );

    useEffect(() => {
        if (!open) {
            return;
        }

        setTitle(getInitialTitleValue(initialSection));
        setDisplayType(getInitialDisplayTypeValue(initialSection));
        setTableColumns(getInitialTableColumnsValue(initialSection));
        setTagInput(getInitialTagsValue(initialSection));
        setMatchMode(getInitialModeValue(initialSection));
        setSortBy(getInitialSortByValue(initialSection));
        setSortOrder(getInitialSortOrderValue(initialSection));
        setLimit(getInitialLimitValue(initialSection));
        setFilters(toFilterDrafts(initialSection));
        setIsTagFilterOpen((initialSection?.tagNames.length ?? 0) > 0);
        setFormError('');
    }, [initialSection, open]);

    const selectedTagNames = normalizeViewTagNames([tagInput]);
    const showTagFilter = isTagFilterOpen || selectedTagNames.length > 0;
    const isAllNotesView = selectedTagNames.length === 0 && filters.length === 0;

    const toggleTableColumn = (column: ViewTableColumn) => {
        if (column === 'title') {
            return;
        }

        setTableColumns((currentColumns) => {
            if (currentColumns.includes(column)) {
                const nextColumns = currentColumns.filter((currentColumn) => currentColumn !== column);
                return nextColumns.length > 0 ? nextColumns : currentColumns;
            }

            return normalizeViewTableColumns([...currentColumns, column]);
        });
        setFormError('');
    };

    const toggleTagName = (tagName: string) => {
        const nextTagNames = selectedTagNames.includes(tagName)
            ? selectedTagNames.filter((value) => value !== tagName)
            : [...selectedTagNames, tagName];

        setTagInput(nextTagNames.join(', '));
        setFormError('');
    };

    const handleAddTagFilter = () => {
        setIsTagFilterOpen(true);
        setFormError('');
    };

    const removeTagFilter = () => {
        setTagInput('');
        setMatchMode('and');
        setIsTagFilterOpen(false);
        setFormError('');
    };

    const handleAddPropertyFilter = () => {
        if (availableProperties.length === 0) {
            setFormError('Create a shared property before adding a filter.');
            return;
        }

        setFilters((current) => [
            ...current,
            {
                id: createFilterId(current.length),
                key: '',
                operator: 'exists',
                value: '',
            },
        ]);
        setFormError('');
    };

    const updateFilter = (id: string, patch: Partial<PropertyFilterDraft>) => {
        setFilters((current) =>
            current.map((filter) => {
                if (filter.id !== id) {
                    return filter;
                }

                const nextFilter = { ...filter, ...patch };
                const property = propertyByKey.get(nextFilter.key);
                const operators = getOperatorsForProperty(property);

                if (!operators.includes(nextFilter.operator)) {
                    nextFilter.operator = getDefaultOperator(property);
                }

                if ('key' in patch) {
                    nextFilter.value = getDefaultValue(property);
                    nextFilter.operator = getDefaultOperator(property);
                }

                return nextFilter;
            }),
        );
        setFormError('');
    };

    const removeFilter = (id: string) => {
        setFilters((current) => current.filter((filter) => filter.id !== id));
        setFormError('');
    };

    return (
        <Modal isOpen={open} onClose={onClose} variant="form" className="sm:max-w-[720px]">
            <Modal.Header title={mode === 'create' ? 'Create view' : 'Edit view'} onClose={onClose} />
            <Modal.Body>
                <form
                    id="view-section-form"
                    className="flex flex-col gap-5"
                    onSubmit={(event) => {
                        event.preventDefault();

                        const tagNames = normalizeViewTagNames([tagInput]);

                        if (showTagFilter && tagNames.length === 0) {
                            setFormError('Choose at least one tag, or remove this tag filter.');
                            return;
                        }

                        const missingPropertyFilter = filters.find(
                            (filter) => !filter.key || !propertyByKey.has(filter.key),
                        );

                        if (missingPropertyFilter) {
                            setFormError('Choose a property for every filter.');
                            return;
                        }

                        const propertyFilters = filters.map((filter) => {
                            const property = propertyByKey.get(filter.key);

                            return {
                                key: property?.key ?? filter.key,
                                valueType: property?.valueType ?? 'text',
                                operator: filter.operator,
                                value: shouldShowFilterValue(filter.operator) ? filter.value : null,
                            };
                        });

                        const hasIncompleteFilter = propertyFilters.some(
                            (filter) => shouldShowFilterValue(filter.operator) && !filter.value?.trim(),
                        );

                        if (hasIncompleteFilter) {
                            setFormError('Fill every filter value, or switch it to is set / is empty.');
                            return;
                        }

                        onSubmit({
                            title,
                            displayType,
                            displayOptions: normalizeViewDisplayOptions({
                                tableColumns,
                            }),
                            tagNames,
                            mode: matchMode,
                            propertyFilters,
                            sortBy,
                            sortOrder,
                            limit: Number(limit),
                        });
                    }}
                >
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="view-section-title" size="md">
                            View name
                        </Label>
                        <Input
                            id="view-section-title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Doing notes"
                            autoFocus
                        />
                    </div>

                    <section className="flex flex-col gap-3 rounded-[18px] border border-border-subtle bg-elevated px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <Label size="md">Display</Label>
                                <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                                    Show the same query as a compact list or a table.
                                </Text>
                            </div>
                            <Text as="span" variant="meta" tone="tertiary">
                                {getViewDisplayTypeLabel(displayType)}
                            </Text>
                        </div>
                        <ToggleGroup
                            type="single"
                            value={displayType}
                            onValueChange={(value) => {
                                if (value === 'list' || value === 'table') {
                                    setDisplayType(value);
                                }
                            }}
                            variant="quiet"
                            size="sm"
                            className="self-start"
                        >
                            <ToggleGroupItem value="list" aria-label="Show as list">
                                List
                            </ToggleGroupItem>
                            <ToggleGroupItem value="table" aria-label="Show as table">
                                Table
                            </ToggleGroupItem>
                        </ToggleGroup>
                        {displayType === 'table' ? (
                            <div className="rounded-[16px] border border-border-subtle bg-subtle/45 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <Label size="sm">Table columns</Label>
                                    <Text as="span" variant="meta" tone="tertiary">
                                        {tableColumns.length} shown
                                    </Text>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    {TABLE_COLUMN_OPTIONS.map((column) => {
                                        const label = getViewTableColumnLabel(column);

                                        return (
                                            <div
                                                key={column}
                                                className="flex items-center gap-2 rounded-[12px] border border-border-subtle bg-elevated px-3 py-2"
                                            >
                                                <Checkbox
                                                    size="sm"
                                                    checked={tableColumns.includes(column)}
                                                    disabled={column === 'title'}
                                                    aria-label={`Show ${label} column`}
                                                    onChange={() => toggleTableColumn(column)}
                                                />
                                                <Text as="span" variant="label" tone="secondary">
                                                    {label}
                                                </Text>
                                            </div>
                                        );
                                    })}
                                </div>
                                <Text as="p" variant="meta" tone="tertiary" className="mt-2">
                                    Title is always shown because it opens the note.
                                </Text>
                            </div>
                        ) : null}
                    </section>

                    <section className="flex flex-col gap-3 rounded-[20px] border border-border-subtle bg-subtle/40 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <Label size="md">Filters</Label>
                                <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                                    Use properties for structured fields, and tags for loose topics or context.
                                </Text>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button type="button" variant="subtle" size="sm" onClick={handleAddPropertyFilter}>
                                    Add property filter
                                </Button>
                                {!showTagFilter && (
                                    <Button type="button" variant="subtle" size="sm" onClick={handleAddTagFilter}>
                                        Add tag filter
                                    </Button>
                                )}
                            </div>
                        </div>

                        {filters.length === 0 && !showTagFilter ? (
                            <div className="rounded-[16px] border border-dashed border-border-subtle bg-elevated/60 px-4 py-3">
                                <Text as="p" variant="label" tone="default">
                                    {isAllNotesView ? 'All notes' : 'No filters'}
                                </Text>
                                <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                                    Add a property filter, a tag filter, or leave this view open to all notes.
                                </Text>
                            </div>
                        ) : null}

                        {filters.length > 0 ? (
                            <div className="flex flex-col gap-2.5">
                                {filters.map((filter) => {
                                    const property = propertyByKey.get(filter.key);
                                    const operators = getOperatorsForProperty(property);

                                    return (
                                        <div
                                            key={filter.id}
                                            className="grid gap-2 rounded-[16px] border border-border-subtle bg-elevated p-3 md:grid-cols-[minmax(0,1fr)_minmax(10.5rem,12rem)_minmax(0,1fr)_auto] md:items-center"
                                        >
                                            <Select
                                                value={filter.key || PROPERTY_PLACEHOLDER_VALUE}
                                                ariaLabel="Property filter property"
                                                className="w-full min-w-0"
                                                onValueChange={(value) => {
                                                    if (value === PROPERTY_PLACEHOLDER_VALUE) {
                                                        return;
                                                    }

                                                    updateFilter(filter.id, { key: value });
                                                }}
                                            >
                                                <SelectItem value={PROPERTY_PLACEHOLDER_VALUE} disabled>
                                                    Choose property
                                                </SelectItem>
                                                {availableProperties.map((propertyOption) => (
                                                    <SelectItem key={propertyOption.key} value={propertyOption.key}>
                                                        {propertyOption.name}
                                                    </SelectItem>
                                                ))}
                                            </Select>

                                            <Select
                                                value={filter.operator}
                                                disabled={!property}
                                                ariaLabel="Property filter operator"
                                                className="w-full min-w-0"
                                                onValueChange={(value) =>
                                                    updateFilter(filter.id, {
                                                        operator: value as ViewPropertyFilterOperator,
                                                    })
                                                }
                                            >
                                                {operators.map((operator) => (
                                                    <SelectItem key={operator} value={operator}>
                                                        {getViewPropertyOperatorLabel(operator)}
                                                    </SelectItem>
                                                ))}
                                            </Select>

                                            {shouldShowFilterValue(filter.operator) && property ? (
                                                property.valueType === 'select' ? (
                                                    <Select
                                                        value={filter.value}
                                                        ariaLabel="Property filter value"
                                                        className="w-full min-w-0"
                                                        onValueChange={(value) => updateFilter(filter.id, { value })}
                                                    >
                                                        {property.options.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </Select>
                                                ) : property.valueType === 'boolean' ? (
                                                    <Select
                                                        value={filter.value || 'true'}
                                                        ariaLabel="Property filter value"
                                                        className="w-full min-w-0"
                                                        onValueChange={(value) => updateFilter(filter.id, { value })}
                                                    >
                                                        <SelectItem value="true">True</SelectItem>
                                                        <SelectItem value="false">False</SelectItem>
                                                    </Select>
                                                ) : (
                                                    <Input
                                                        type={getFilterInputType(property, filter.operator)}
                                                        value={filter.value}
                                                        onChange={(event) =>
                                                            updateFilter(filter.id, { value: event.target.value })
                                                        }
                                                        placeholder={getFilterInputPlaceholder(
                                                            property,
                                                            filter.operator,
                                                        )}
                                                        aria-label="Property filter value"
                                                    />
                                                )
                                            ) : (
                                                <Text as="span" variant="label" tone="tertiary">
                                                    {property ? 'No value needed' : 'Choose a property first'}
                                                </Text>
                                            )}

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeFilter(filter.id)}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : null}

                        {showTagFilter ? (
                            <div className="flex flex-col gap-3 rounded-[16px] border border-border-subtle bg-elevated p-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <Text as="p" variant="label" tone="default">
                                            Tag filter
                                        </Text>
                                        <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                                            Match notes by selected tags.
                                        </Text>
                                    </div>
                                    <Button type="button" variant="ghost" size="sm" onClick={removeTagFilter}>
                                        Remove
                                    </Button>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="view-section-tags" size="sm">
                                        Tag names
                                    </Label>
                                    <Textarea
                                        id="view-section-tags"
                                        value={tagInput}
                                        onChange={(event) => {
                                            setTagInput(event.target.value);
                                            setFormError('');
                                        }}
                                        placeholder="@OceanBrain, @todo"
                                        size="sm"
                                    />
                                    <Text as="p" variant="meta" tone="tertiary">
                                        You can use tags only, properties only, both together, or no filters.
                                    </Text>
                                </div>

                                {selectedTagNames.length > 1 ? (
                                    <div className="flex flex-col gap-2">
                                        <Label size="sm">Tag match</Label>
                                        <ToggleGroup
                                            type="single"
                                            value={matchMode}
                                            onValueChange={(value) => {
                                                if (value === 'and' || value === 'or') {
                                                    setMatchMode(value);
                                                }
                                            }}
                                            variant="quiet"
                                            size="sm"
                                            className="self-start"
                                        >
                                            <ToggleGroupItem value="and" aria-label={getViewTagMatchLabel('and')}>
                                                AND
                                            </ToggleGroupItem>
                                            <ToggleGroupItem value="or" aria-label={getViewTagMatchLabel('or')}>
                                                OR
                                            </ToggleGroupItem>
                                        </ToggleGroup>
                                        <Text as="p" variant="meta" tone="tertiary">
                                            AND requires every selected tag. OR accepts any selected tag.
                                        </Text>
                                    </div>
                                ) : null}

                                <div className="flex items-center justify-between gap-3">
                                    <Label size="sm">Existing tags</Label>
                                    <Text as="span" variant="meta" tone="tertiary">
                                        {isTagsLoading ? 'Loading...' : `${availableTags.length} available`}
                                    </Text>
                                </div>
                                {availableTags.length > 0 ? (
                                    <div className="max-h-44 overflow-y-auto rounded-[16px] border border-border-subtle bg-hover-subtle/60 p-3">
                                        <div className="flex flex-wrap gap-2">
                                            {availableTags.map((tag) => {
                                                const isSelected = selectedTagNames.includes(tag.name);

                                                return (
                                                    <button
                                                        key={tag.id}
                                                        type="button"
                                                        className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                                                            isSelected
                                                                ? 'border-border-secondary bg-elevated text-fg-default'
                                                                : 'border-border-subtle bg-transparent text-fg-secondary hover:border-border-secondary hover:bg-elevated hover:text-fg-default'
                                                        }`}
                                                        aria-pressed={isSelected}
                                                        onClick={() => toggleTagName(tag.name)}
                                                    >
                                                        {tag.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <Text as="p" variant="meta" tone="tertiary">
                                        No tags yet. You can still type tag names manually.
                                    </Text>
                                )}
                            </div>
                        ) : null}

                        <Text
                            as="p"
                            variant="meta"
                            tone={formError ? 'default' : 'tertiary'}
                            className={formError ? 'text-fg-error' : undefined}
                        >
                            {formError ||
                                (isPropertiesLoading || isTagsLoading
                                    ? 'Loading filter options...'
                                    : `${availableProperties.length} properties · ${availableTags.length} tags available`)}
                        </Text>
                    </section>

                    <details className="group rounded-[18px] border border-border-subtle bg-elevated px-4 py-3">
                        <summary className="cursor-pointer list-none">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <Text as="span" variant="label" tone="default">
                                        Sort and limit
                                    </Text>
                                    <Text as="p" variant="meta" tone="tertiary" className="mt-1">
                                        Defaults to recently updated notes.
                                    </Text>
                                </div>
                                <Text as="span" variant="meta" tone="tertiary">
                                    {limit} notes
                                </Text>
                            </div>
                        </summary>

                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="view-section-sort-by" size="sm">
                                    Sort by
                                </Label>
                                <Select value={sortBy} onValueChange={(value) => setSortBy(value as ViewSortBy)}>
                                    <SelectItem value="updatedAt">Updated time</SelectItem>
                                    <SelectItem value="createdAt">Created time</SelectItem>
                                    <SelectItem value="title">Title</SelectItem>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="view-section-sort-order" size="sm">
                                    Order
                                </Label>
                                <Select
                                    value={sortOrder}
                                    onValueChange={(value) => setSortOrder(value as ViewSortOrder)}
                                >
                                    <SelectItem value="desc">Descending</SelectItem>
                                    <SelectItem value="asc">Ascending</SelectItem>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="view-section-limit" size="sm">
                                    Max notes
                                </Label>
                                <Select value={limit} onValueChange={setLimit}>
                                    <SelectItem value="3">3 notes</SelectItem>
                                    <SelectItem value="5">5 notes</SelectItem>
                                    <SelectItem value="8">8 notes</SelectItem>
                                    <SelectItem value="10">10 notes</SelectItem>
                                    <SelectItem value="12">12 notes</SelectItem>
                                </Select>
                            </div>
                        </div>
                    </details>
                </form>
            </Modal.Body>
            <Modal.Footer>
                <ModalActionRow>
                    <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" size="sm" form="view-section-form">
                        {mode === 'create' ? 'Create view' : 'Save view'}
                    </Button>
                </ModalActionRow>
            </Modal.Footer>
        </Modal>
    );
}
