export type ViewTagFilterMatchMode = 'and' | 'or';
export type ViewDisplayType = 'list' | 'table' | 'board' | 'calendar';
export type ViewTableColumn = 'title' | 'tags' | 'properties' | 'createdAt' | 'updatedAt';
export type ViewCalendarDateField = 'createdAt' | 'updatedAt' | 'property';
export type ViewPropertyFilterOperator =
    | 'equals'
    | 'notEquals'
    | 'contains'
    | 'notContains'
    | 'before'
    | 'after'
    | 'exists'
    | 'notExists';
export type ViewSortBy = 'updatedAt' | 'createdAt' | 'title';
export type ViewSortOrder = 'asc' | 'desc';

export interface ViewDisplayOptions {
    tableColumns: ViewTableColumn[];
    tablePropertyKeys: string[];
    boardGroupByPropertyKey: string | null;
    calendarDateField: ViewCalendarDateField;
    calendarDatePropertyKey: string | null;
}

export interface ViewPropertyFilter {
    key: string;
    name: string;
    valueType: 'text' | 'url' | 'number' | 'date' | 'boolean' | 'select';
    operator: ViewPropertyFilterOperator;
    value?: string | null;
}

export interface View {
    id: string;
    groupId: string;
    title: string;
    displayType: ViewDisplayType;
    displayOptions: ViewDisplayOptions;
    tagNames: string[];
    mode: ViewTagFilterMatchMode;
    propertyFilters: ViewPropertyFilter[];
    sortBy: ViewSortBy;
    sortOrder: ViewSortOrder;
    limit: number;
    order: number;
}

export interface ViewGroup {
    id: string;
    title: string;
    order: number;
    views: View[];
}

export interface ViewsWorkspace {
    activeGroupId: string | null;
    groups: ViewGroup[];
}

import type { NotePropertyOption, NotePropertyValueType } from './note.model';

export interface ViewNoteCreationContext {
    viewId: string;
    title: string;
    tagNames: string[];
    mode: ViewTagFilterMatchMode;
    defaultTagNames: string[];
    properties: {
        key: string;
        name: string;
        valueType: NotePropertyValueType;
        defaultValue: string | null;
        required: boolean;
        options: NotePropertyOption[];
        filters: ViewPropertyFilter[];
    }[];
}
