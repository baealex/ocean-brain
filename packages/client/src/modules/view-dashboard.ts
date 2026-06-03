import type {
    ViewDisplayOptions,
    ViewDisplayType,
    ViewPropertyFilter,
    ViewPropertyFilterOperator,
    ViewSection,
    ViewsWorkspace,
    ViewTab,
    ViewTableColumn,
    ViewTagMatchMode,
} from '~/models/view.model';

export const DEFAULT_VIEW_SECTION_LIMIT = 5;
export const MIN_VIEW_SECTION_LIMIT = 1;
export const MAX_VIEW_SECTION_LIMIT = 20;
export const DEFAULT_VIEW_TABLE_COLUMNS: ViewTableColumn[] = ['title', 'tags', 'properties', 'createdAt', 'updatedAt'];

export const EMPTY_VIEWS_WORKSPACE: ViewsWorkspace = {
    activeTabId: null,
    tabs: [],
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
        return `@${trimmedValue.slice(1)}`;
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

export const normalizeViewTagNames = (values: unknown[]) => {
    const normalizedTagNames = values.flatMap((value) => {
        if (typeof value === 'string') {
            return value.split(',');
        }

        return [];
    });

    return Array.from(new Set(normalizedTagNames.map(normalizeTagName).filter(Boolean)));
};

export const getActiveViewTab = (workspace: ViewsWorkspace): ViewTab | null => {
    if (workspace.tabs.length === 0) {
        return null;
    }

    if (!workspace.activeTabId) {
        return workspace.tabs[0] ?? null;
    }

    return workspace.tabs.find((tab) => tab.id === workspace.activeTabId) ?? workspace.tabs[0] ?? null;
};

export const setActiveViewTabInWorkspace = (workspace: ViewsWorkspace, tabId: string): ViewsWorkspace => {
    if (!workspace.tabs.some((tab) => tab.id === tabId)) {
        return workspace;
    }

    return {
        ...workspace,
        activeTabId: tabId,
    };
};

export const reorderViewTabsInWorkspace = (
    workspace: ViewsWorkspace,
    activeTabId: string,
    overTabId: string,
): ViewsWorkspace => ({
    ...workspace,
    tabs: reorderArrayItems(workspace.tabs, activeTabId, overTabId),
});

export const reorderViewSectionsInWorkspace = (
    workspace: ViewsWorkspace,
    tabId: string,
    activeSectionId: string,
    overSectionId: string,
): ViewsWorkspace => ({
    ...workspace,
    tabs: workspace.tabs.map((tab) =>
        tab.id === tabId
            ? {
                  ...tab,
                  sections: reorderArrayItems(tab.sections, activeSectionId, overSectionId),
              }
            : tab,
    ),
});

export const getViewTagMatchLabel = (mode: ViewTagMatchMode) => {
    return mode === 'or' ? 'OR — any selected tag' : 'AND — all selected tags';
};

export const getViewTagMatchToken = (mode: ViewTagMatchMode) => {
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
        case 'calendar':
            return 'Unavailable';
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

export const normalizeViewDisplayOptions = (options?: Partial<ViewDisplayOptions> | null): ViewDisplayOptions => ({
    tableColumns: normalizeViewTableColumns(options?.tableColumns),
});

export const formatViewPropertyFilter = (filter: ViewPropertyFilter) => {
    const operatorLabel = getViewPropertyOperatorLabel(filter.operator);

    if (filter.operator === 'exists' || filter.operator === 'notExists') {
        return `${filter.name} ${operatorLabel}`;
    }

    return `${filter.name} ${operatorLabel} ${filter.value ?? ''}`.trim();
};

export const buildViewSectionInput = (
    section: ViewSection,
    overrides: Partial<Pick<ViewSection, 'sortBy' | 'sortOrder' | 'displayOptions' | 'displayType'>> = {},
) => {
    const nextSection = {
        ...section,
        ...overrides,
    };

    return {
        title: nextSection.title,
        displayType: nextSection.displayType,
        displayOptions: normalizeViewDisplayOptions(nextSection.displayOptions),
        tagNames: nextSection.tagNames,
        mode: nextSection.mode,
        propertyFilters: nextSection.propertyFilters.map((filter) => ({
            key: filter.key,
            valueType: filter.valueType,
            operator: filter.operator,
            value: filter.value,
        })),
        sortBy: nextSection.sortBy,
        sortOrder: nextSection.sortOrder,
        limit: nextSection.limit,
    };
};

export const buildViewNotesSearch = (section: Pick<ViewSection, 'id'>) => ({
    page: 1,
    sectionId: section.id,
});
