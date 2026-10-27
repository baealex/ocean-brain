import type {
    View,
    ViewCalendarDateField,
    ViewDisplayOptions,
    ViewDisplayType,
    ViewGroup,
    ViewPropertyFilter,
    ViewPropertyFilterOperator,
    ViewsWorkspace,
    ViewTableColumn,
    ViewTagFilterMatchMode,
} from '~/models/view.model';

export const DEFAULT_VIEW_LIMIT = 5;
export const MIN_VIEW_LIMIT = 1;
export const MAX_VIEW_LIMIT = 20;
export const MAX_VIEW_TABLE_PROPERTY_COLUMNS = 6;
export const DEFAULT_VIEW_TABLE_COLUMNS: ViewTableColumn[] = ['title', 'tags', 'properties', 'createdAt', 'updatedAt'];
export const DEFAULT_VIEW_CALENDAR_DATE_FIELD: ViewCalendarDateField = 'createdAt';

export const EMPTY_VIEWS_WORKSPACE: ViewsWorkspace = {
    activeGroupId: null,
    groups: [],
};

const normalizeTagName = (value: string) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return '';
    }

    if (trimmedValue.startsWith('@')) {
        return trimmedValue;
    }

    if (trimmedValue.startsWith('#')) {
        return '';
    }

    return `@${trimmedValue}`;
};

const reorderArrayItems = <TValue extends { id: string }>(items: TValue[], activeId: string, overId: string) => {
    if (activeId === overId) {
        return items;
    }

    const oldIndex = items.findIndex((item) => item.id === activeId);
    const newIndex = items.findIndex((item) => item.id === overId);

    if (oldIndex < 0 || newIndex < 0) {
        return items;
    }

    const nextItems = [...items];
    const [movedItem] = nextItems.splice(oldIndex, 1);
    nextItems.splice(newIndex, 0, movedItem);
    return nextItems;
};

export type ViewMoveDirection = 'previous' | 'next';

const getAdjacentItemId = <TValue extends { id: string }>(
    items: TValue[],
    itemId: string,
    direction: ViewMoveDirection,
) => {
    const currentIndex = items.findIndex((item) => item.id === itemId);
    const nextIndex = currentIndex + (direction === 'previous' ? -1 : 1);

    return currentIndex >= 0 && nextIndex >= 0 && nextIndex < items.length ? items[nextIndex]?.id : undefined;
};

export const normalizeViewTagFilterNames = (values: unknown[]) => {
    const normalizedTagNames = values.flatMap((value) => {
        if (typeof value === 'string') {
            return value.split(',');
        }

        return [];
    });

    return Array.from(new Set(normalizedTagNames.map(normalizeTagName).filter(Boolean)));
};

export const getActiveViewGroup = (workspace: ViewsWorkspace): ViewGroup | null => {
    if (workspace.groups.length === 0) {
        return null;
    }

    if (!workspace.activeGroupId) {
        return workspace.groups[0] ?? null;
    }

    return workspace.groups.find((group) => group.id === workspace.activeGroupId) ?? workspace.groups[0] ?? null;
};

export const setActiveViewGroupInWorkspace = (workspace: ViewsWorkspace, groupId: string): ViewsWorkspace => {
    if (!workspace.groups.some((group) => group.id === groupId)) {
        return workspace;
    }

    return {
        ...workspace,
        activeGroupId: groupId,
    };
};

export const reorderViewGroupsInWorkspace = (
    workspace: ViewsWorkspace,
    activeGroupId: string,
    overGroupId: string,
): ViewsWorkspace => ({
    ...workspace,
    groups: reorderArrayItems(workspace.groups, activeGroupId, overGroupId),
});

export const reorderViewsInWorkspace = (
    workspace: ViewsWorkspace,
    groupId: string,
    activeViewId: string,
    overViewId: string,
): ViewsWorkspace => ({
    ...workspace,
    groups: workspace.groups.map((group) =>
        group.id === groupId
            ? {
                  ...group,
                  views: reorderArrayItems(group.views, activeViewId, overViewId),
              }
            : group,
    ),
});

export const moveViewGroupInWorkspace = (
    workspace: ViewsWorkspace,
    groupId: string,
    direction: ViewMoveDirection,
): ViewsWorkspace => {
    const adjacentGroupId = getAdjacentItemId(workspace.groups, groupId, direction);
    return adjacentGroupId ? reorderViewGroupsInWorkspace(workspace, groupId, adjacentGroupId) : workspace;
};

export const moveViewInWorkspace = (
    workspace: ViewsWorkspace,
    groupId: string,
    viewId: string,
    direction: ViewMoveDirection,
): ViewsWorkspace => {
    const views = workspace.groups.find((group) => group.id === groupId)?.views ?? [];
    const adjacentViewId = getAdjacentItemId(views, viewId, direction);
    return adjacentViewId ? reorderViewsInWorkspace(workspace, groupId, viewId, adjacentViewId) : workspace;
};

export const getViewTagFilterMatchLabel = (mode: ViewTagFilterMatchMode) => {
    return mode === 'or' ? 'OR — any selected tag' : 'AND — all selected tags';
};

export const getViewTagFilterMatchToken = (mode: ViewTagFilterMatchMode) => {
    return mode === 'or' ? 'OR' : 'AND';
};

export const getViewPropertyOperatorLabel = (operator: ViewPropertyFilterOperator) => {
    switch (operator) {
        case 'notEquals':
            return 'is not';
        case 'contains':
            return 'contains';
        case 'notContains':
            return 'does not contain';
        case 'before':
            return 'before';
        case 'after':
            return 'after';
        case 'exists':
            return 'is set';
        case 'notExists':
            return 'is empty';
        case 'equals':
        default:
            return 'is';
    }
};

export const getViewDisplayTypeLabel = (displayType: ViewDisplayType) => {
    switch (displayType) {
        case 'table':
            return 'Table';
        case 'board':
            return 'Board';
        case 'calendar':
            return 'Calendar';
        case 'list':
        default:
            return 'List';
    }
};

export const getViewTableColumnLabel = (column: ViewTableColumn) => {
    switch (column) {
        case 'tags':
            return 'Tags';
        case 'properties':
            return 'Properties';
        case 'createdAt':
            return 'Created';
        case 'updatedAt':
            return 'Updated';
        case 'title':
        default:
            return 'Title';
    }
};

export const normalizeViewTableColumns = (columns?: readonly ViewTableColumn[] | null): ViewTableColumn[] => {
    const allowedColumns = new Set(DEFAULT_VIEW_TABLE_COLUMNS);
    const nextColumns = (columns ?? []).filter((column): column is ViewTableColumn => allowedColumns.has(column));
    const uniqueColumns = Array.from(new Set(nextColumns));

    if (uniqueColumns.length === 0) {
        return [...DEFAULT_VIEW_TABLE_COLUMNS];
    }

    return uniqueColumns.includes('title') ? uniqueColumns : ['title', ...uniqueColumns];
};

export const normalizeViewTablePropertyKeys = (keys?: readonly string[] | null): string[] =>
    Array.from(new Set((keys ?? []).map((key) => key.trim()).filter(Boolean))).slice(
        0,
        MAX_VIEW_TABLE_PROPERTY_COLUMNS,
    );

export const normalizeViewCalendarDateField = (value?: ViewCalendarDateField | null): ViewCalendarDateField =>
    value === 'updatedAt' || value === 'property' ? value : DEFAULT_VIEW_CALENDAR_DATE_FIELD;

export const normalizeViewDisplayOptions = (options?: Partial<ViewDisplayOptions> | null): ViewDisplayOptions => {
    const calendarDateField = normalizeViewCalendarDateField(options?.calendarDateField);

    return {
        tableColumns: normalizeViewTableColumns(options?.tableColumns),
        tablePropertyKeys: normalizeViewTablePropertyKeys(options?.tablePropertyKeys),
        boardGroupByPropertyKey: options?.boardGroupByPropertyKey?.trim() || null,
        calendarDateField,
        calendarDatePropertyKey:
            calendarDateField === 'property' ? options?.calendarDatePropertyKey?.trim() || null : null,
    };
};

export const formatViewPropertyFilter = (filter: ViewPropertyFilter) => {
    const operatorLabel = getViewPropertyOperatorLabel(filter.operator);

    if (filter.operator === 'exists' || filter.operator === 'notExists') {
        return `${filter.name} ${operatorLabel}`;
    }

    return `${filter.name} ${operatorLabel} ${filter.value ?? ''}`.trim();
};

export const buildViewInput = (
    view: View,
    overrides: Partial<Pick<View, 'sortBy' | 'sortOrder' | 'displayOptions' | 'displayType'>> = {},
) => {
    const nextView = {
        ...view,
        ...overrides,
    };

    return {
        title: nextView.title,
        displayType: nextView.displayType,
        displayOptions: normalizeViewDisplayOptions(nextView.displayOptions),
        tagNames: nextView.tagNames,
        mode: nextView.mode,
        propertyFilters: nextView.propertyFilters.map((filter) => ({
            key: filter.key,
            valueType: filter.valueType,
            operator: filter.operator,
            value: filter.value,
        })),
        sortBy: nextView.sortBy,
        sortOrder: nextView.sortOrder,
        limit: nextView.limit,
    };
};
