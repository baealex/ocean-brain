export type ViewTagMatchMode = 'and' | 'or';
export type ViewDisplayType = 'list' | 'calendar';
export type ViewPropertyFilterOperator = 'equals' | 'before' | 'after' | 'exists' | 'notExists';
export type ViewSortBy = 'updatedAt' | 'createdAt' | 'title';
export type ViewSortOrder = 'asc' | 'desc';

export interface ViewPropertyFilter {
    key: string;
    name: string;
    valueType: 'text' | 'number' | 'date' | 'boolean' | 'select';
    operator: ViewPropertyFilterOperator;
    value?: string | null;
}

export interface ViewSection {
    id: string;
    tabId: string;
    title: string;
    displayType: ViewDisplayType;
    tagNames: string[];
    mode: ViewTagMatchMode;
    propertyFilters: ViewPropertyFilter[];
    sortBy: ViewSortBy;
    sortOrder: ViewSortOrder;
    limit: number;
    order: number;
}

export interface ViewTab {
    id: string;
    title: string;
    order: number;
    sections: ViewSection[];
}

export interface ViewsWorkspace {
    activeTabId: string | null;
    tabs: ViewTab[];
}
