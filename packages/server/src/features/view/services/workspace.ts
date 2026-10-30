import type { Note, Prisma, PropertyValueType } from '@prisma/client';
import {
    InvalidNotePropertyInputError,
    normalizePropertyKey,
    normalizeUrlValue,
} from '~/features/note/services/properties.js';
import { buildNoteTagNamesWhere, type NoteTagMatchMode } from '~/features/note/services/tag-filter.js';
import {
    assertSameWorkspace,
    DEFAULT_WORKSPACE_ID,
    parseWorkspaceId,
    requireWorkspace,
    resolvedWorkspaceScope,
    resolveWorkspaceWhere,
    type WorkspaceScopeInput,
} from '~/features/workspace/scope.js';
import models from '~/models.js';

export type ViewTagFilterMatchMode = NoteTagMatchMode;
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

export interface ViewDisplayOptionsRecord {
    tableColumns: ViewTableColumn[];
    tablePropertyKeys: string[];
    boardGroupByPropertyKey: string | null;
    calendarDateField: ViewCalendarDateField;
    calendarDatePropertyKey: string | null;
}

export interface ViewPropertyFilterRecord {
    key: string;
    name: string;
    valueType: PropertyValueType;
    operator: ViewPropertyFilterOperator;
    value: string | null;
}

export interface ViewRecord {
    workspaceId: string;
    defaultTemplateNoteId?: string | null;
    id: string;
    groupId: string;
    title: string;
    displayType: ViewDisplayType;
    displayOptions: ViewDisplayOptionsRecord;
    tagNames: string[];
    mode: ViewTagFilterMatchMode;
    propertyFilters: ViewPropertyFilterRecord[];
    sortBy: ViewSortBy;
    sortOrder: ViewSortOrder;
    limit: number;
    order: number;
}

export interface ViewGroupRecord {
    workspaceId: string;
    id: string;
    title: string;
    order: number;
    views: ViewRecord[];
}

export interface ViewWorkspaceRecord {
    activeGroupId: string | null;
    groups: ViewGroupRecord[];
}

export interface ViewInput {
    defaultTemplateNoteId?: string | null;
    title?: string;
    displayType?: ViewDisplayType;
    displayOptions?: ViewDisplayOptionsInput | null;
    tagNames?: string[] | null;
    mode?: ViewTagFilterMatchMode;
    propertyFilters?: ViewPropertyFilterInput[] | null;
    sortBy?: ViewSortBy;
    sortOrder?: ViewSortOrder;
    limit?: number;
}

export interface ViewNotesQueryInput {
    scope?: WorkspaceScopeInput;
    tagNames?: string[] | null;
    mode?: ViewTagFilterMatchMode;
    propertyFilters?: ViewPropertyFilterInput[] | null;
    sortBy?: ViewSortBy;
    sortOrder?: ViewSortOrder;
}

export interface ViewNotesQueryRecord {
    tagNames: string[];
    mode: ViewTagFilterMatchMode;
    propertyFilters: ViewPropertyFilterRecord[];
    sortBy: ViewSortBy;
    sortOrder: ViewSortOrder;
}

export interface ViewPropertyFilterInput {
    key: string;
    operator: ViewPropertyFilterOperator;
    value?: string | null;
    valueType?: PropertyValueType | null;
}

export interface ViewDisplayOptionsInput {
    tableColumns?: ViewTableColumn[] | null;
    tablePropertyKeys?: string[] | null;
    boardGroupByPropertyKey?: string | null;
    calendarDateField?: ViewCalendarDateField | null;
    calendarDatePropertyKey?: string | null;
}

export interface ViewNotesResult {
    totalCount: number;
    notes: Note[];
}

export interface ViewBoardColumnNotesResult {
    totalCount: number;
    notes: Array<Pick<Note, 'id' | 'title' | 'updatedAt'>>;
}

export type ViewCalendarNote = Pick<Note, 'id' | 'title'> & {
    calendarDate: string;
};

export interface ViewCalendarDateRangeInput {
    start: string;
    end: string;
}

export const DEFAULT_VIEW_LIMIT = 5;
export const MIN_VIEW_LIMIT = 1;
export const MAX_VIEW_LIMIT = 20;
export const DEFAULT_VIEW_NOTES_QUERY_LIMIT = 20;
export const MAX_VIEW_NOTES_QUERY_LIMIT = 50;
const MAX_VIEW_PROPERTY_FILTERS = 10;
const MAX_VIEW_TABLE_PROPERTY_COLUMNS = 6;
const MAX_VIEW_CALENDAR_RANGE_MS = 32 * 24 * 60 * 60 * 1000;
const DEFAULT_VIEW_DISPLAY_TYPE: ViewDisplayType = 'list';
const DEFAULT_VIEW_SORT_BY: ViewSortBy = 'updatedAt';
const DEFAULT_VIEW_SORT_ORDER: ViewSortOrder = 'desc';
const DEFAULT_VIEW_TABLE_COLUMNS: ViewTableColumn[] = ['title', 'tags', 'properties', 'createdAt', 'updatedAt'];
const DEFAULT_VIEW_CALENDAR_DATE_FIELD: ViewCalendarDateField = 'createdAt';

type ViewDbClient = typeof models | Prisma.TransactionClient;

const orderedViewTagFiltersInclude = {
    group: { select: { workspaceId: true } },
    tagFilters: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    },
} satisfies Prisma.ViewInclude;

const orderedViewGroupViewsInclude = {
    views: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        include: orderedViewTagFiltersInclude,
    },
} satisfies Prisma.ViewGroupInclude;

type DbView = Prisma.ViewGetPayload<{
    include: typeof orderedViewTagFiltersInclude;
}>;

type DbViewGroup = Prisma.ViewGroupGetPayload<{
    include: typeof orderedViewGroupViewsInclude;
}>;

const normalizeTagName = (value: string) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return '';
    }

    if (trimmedValue.startsWith('@')) {
        return trimmedValue;
    }

    if (trimmedValue.startsWith('#')) {
        throw new Error('View tag names must use @, not #.');
    }

    return `@${trimmedValue}`;
};

export const normalizeViewTagFilterNames = (values: string[]) => {
    const normalizedTagNames = values.flatMap((value) => value.split(','));

    return Array.from(new Set(normalizedTagNames.map(normalizeTagName).filter(Boolean)));
};

interface StoredViewQuery {
    defaultTemplateNoteId?: string | null;
    propertyFilters?: ViewPropertyFilterRecord[];
    sortBy?: ViewSortBy;
    sortOrder?: ViewSortOrder;
    displayOptions?: Partial<ViewDisplayOptionsRecord>;
}

interface ParsedStoredViewQuery {
    defaultTemplateNoteId?: string | null;
    propertyFilters: ViewPropertyFilterRecord[];
    sortBy: ViewSortBy;
    sortOrder: ViewSortOrder;
    displayOptions: ViewDisplayOptionsRecord;
}

const isViewPropertyFilterOperator = (value: unknown): value is ViewPropertyFilterOperator => {
    return (
        value === 'equals' ||
        value === 'notEquals' ||
        value === 'contains' ||
        value === 'notContains' ||
        value === 'before' ||
        value === 'after' ||
        value === 'exists' ||
        value === 'notExists'
    );
};

const isPropertyValueType = (value: unknown): value is PropertyValueType => {
    return (
        value === 'text' ||
        value === 'url' ||
        value === 'number' ||
        value === 'date' ||
        value === 'boolean' ||
        value === 'select'
    );
};

const isViewTableColumn = (value: unknown): value is ViewTableColumn => {
    return (
        value === 'title' ||
        value === 'tags' ||
        value === 'properties' ||
        value === 'createdAt' ||
        value === 'updatedAt'
    );
};

const normalizeViewDisplayType = (value: ViewDisplayType | undefined): ViewDisplayType => {
    if (value === 'table' || value === 'board' || value === 'calendar') {
        return value;
    }

    return DEFAULT_VIEW_DISPLAY_TYPE;
};

const normalizeViewSortBy = (value: ViewSortBy | undefined): ViewSortBy => {
    return value === 'createdAt' || value === 'title' ? value : DEFAULT_VIEW_SORT_BY;
};

const normalizeViewSortOrder = (value: ViewSortOrder | undefined): ViewSortOrder => {
    return value === 'asc' ? 'asc' : DEFAULT_VIEW_SORT_ORDER;
};

export const normalizeViewTableColumns = (columns: ViewTableColumn[] | null | undefined): ViewTableColumn[] => {
    const normalizedColumns = (columns ?? []).filter(isViewTableColumn);
    const uniqueColumns = Array.from(new Set(normalizedColumns));

    if (uniqueColumns.length === 0) {
        return [...DEFAULT_VIEW_TABLE_COLUMNS];
    }

    return uniqueColumns.includes('title') ? uniqueColumns : ['title' as const, ...uniqueColumns];
};

export const normalizeViewTablePropertyKeys = (keys: string[] | null | undefined): string[] =>
    Array.from(new Set((keys ?? []).map(normalizePropertyKey))).slice(0, MAX_VIEW_TABLE_PROPERTY_COLUMNS);

export const normalizeViewCalendarDateField = (
    value: ViewCalendarDateField | null | undefined,
): ViewCalendarDateField => (value === 'updatedAt' || value === 'property' ? value : DEFAULT_VIEW_CALENDAR_DATE_FIELD);

export const normalizeViewDisplayOptions = (
    options: ViewDisplayOptionsInput | Partial<ViewDisplayOptionsRecord> | null | undefined,
): ViewDisplayOptionsRecord => {
    const calendarDateField = normalizeViewCalendarDateField(options?.calendarDateField);

    return {
        tableColumns: normalizeViewTableColumns(options?.tableColumns),
        tablePropertyKeys: normalizeViewTablePropertyKeys(options?.tablePropertyKeys),
        boardGroupByPropertyKey: options?.boardGroupByPropertyKey
            ? normalizePropertyKey(options.boardGroupByPropertyKey)
            : null,
        calendarDateField,
        calendarDatePropertyKey:
            calendarDateField === 'property' && options?.calendarDatePropertyKey
                ? normalizePropertyKey(options.calendarDatePropertyKey)
                : null,
    };
};

const normalizeFilterValue = ({
    value,
    valueType,
    operator,
}: {
    value?: string | null;
    valueType: PropertyValueType;
    operator: ViewPropertyFilterOperator;
}) => {
    if (operator === 'exists' || operator === 'notExists') {
        return null;
    }

    const normalizedValue = String(value ?? '').trim();

    if (!normalizedValue) {
        throw new InvalidNotePropertyInputError('Property filter value is required.');
    }

    if (valueType === 'number' && !Number.isFinite(Number(normalizedValue))) {
        throw new InvalidNotePropertyInputError('Number property filter value must be finite.');
    }

    if (valueType === 'boolean' && normalizedValue !== 'true' && normalizedValue !== 'false') {
        throw new InvalidNotePropertyInputError('Boolean property filter value must be true or false.');
    }

    if (valueType === 'date') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
            throw new InvalidNotePropertyInputError('Date property filter values must use YYYY-MM-DD.');
        }

        const date = new Date(`${normalizedValue}T00:00:00.000Z`);

        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalizedValue) {
            throw new InvalidNotePropertyInputError('Date property filter value is invalid.');
        }
    }

    if ((operator === 'before' || operator === 'after') && valueType !== 'date' && valueType !== 'number') {
        throw new InvalidNotePropertyInputError('Before and after filters require date or number properties.');
    }

    if ((operator === 'contains' || operator === 'notContains') && valueType !== 'text' && valueType !== 'url') {
        throw new InvalidNotePropertyInputError('Contains filters require text or url properties.');
    }

    if (valueType === 'url' && operator !== 'contains' && operator !== 'notContains') {
        return normalizeUrlValue(normalizedValue);
    }

    return normalizedValue;
};

export const normalizeViewPropertyFilters = (filters: ViewPropertyFilterInput[] | null | undefined) => {
    const normalizedFilters = filters ?? [];

    if (normalizedFilters.length > MAX_VIEW_PROPERTY_FILTERS) {
        throw new InvalidNotePropertyInputError(`A view can have up to ${MAX_VIEW_PROPERTY_FILTERS} property filters.`);
    }

    return normalizedFilters
        .map((filter): ViewPropertyFilterRecord | null => {
            const key = normalizePropertyKey(filter.key);
            const valueType = filter.valueType;
            const operator = filter.operator;

            if (!isPropertyValueType(valueType)) {
                throw new InvalidNotePropertyInputError('Property filter value type is required.');
            }

            if (!isViewPropertyFilterOperator(operator)) {
                throw new InvalidNotePropertyInputError('Property filter operator is invalid.');
            }

            const storedName = (filter as { name?: unknown }).name;
            const name = typeof storedName === 'string' && storedName.trim() ? storedName.trim() : key;

            return {
                key,
                name,
                valueType,
                operator,
                value: normalizeFilterValue({
                    value: filter.value,
                    valueType,
                    operator,
                }),
            };
        })
        .filter((filter): filter is ViewPropertyFilterRecord => filter !== null);
};

const parseStoredViewQuery = (value: string | null): ParsedStoredViewQuery => {
    if (!value) {
        return {
            propertyFilters: [],
            sortBy: DEFAULT_VIEW_SORT_BY,
            sortOrder: DEFAULT_VIEW_SORT_ORDER,
            displayOptions: normalizeViewDisplayOptions(null),
        };
    }

    try {
        const parsed = JSON.parse(value) as Partial<StoredViewQuery>;

        return {
            defaultTemplateNoteId:
                typeof parsed.defaultTemplateNoteId === 'string' ? parsed.defaultTemplateNoteId : null,
            propertyFilters: normalizeViewPropertyFilters(parsed.propertyFilters ?? []),
            sortBy: normalizeViewSortBy(parsed.sortBy),
            sortOrder: normalizeViewSortOrder(parsed.sortOrder),
            displayOptions: normalizeViewDisplayOptions(parsed.displayOptions),
        };
    } catch {
        return {
            propertyFilters: [],
            sortBy: DEFAULT_VIEW_SORT_BY,
            sortOrder: DEFAULT_VIEW_SORT_ORDER,
            displayOptions: normalizeViewDisplayOptions(null),
        };
    }
};

const serializeStoredViewQuery = ({
    defaultTemplateNoteId,
    propertyFilters,
    sortBy,
    sortOrder,
    displayOptions,
}: ParsedStoredViewQuery) => {
    return JSON.stringify({
        ...(defaultTemplateNoteId ? { defaultTemplateNoteId } : {}),
        propertyFilters,
        sortBy,
        sortOrder,
        displayOptions,
    });
};

export const clampViewLimit = (value: number | undefined) => {
    const numericValue = typeof value === 'number' ? value : Number.NaN;

    if (!Number.isInteger(numericValue)) {
        return DEFAULT_VIEW_LIMIT;
    }

    return Math.min(MAX_VIEW_LIMIT, Math.max(MIN_VIEW_LIMIT, numericValue));
};

export const normalizeViewGroupTitle = (title: string) => {
    const trimmedTitle = title.trim();

    return trimmedTitle || 'Untitled View';
};

const buildDefaultViewTitle = (tagNames: string[], propertyFilters: ViewPropertyFilterRecord[]) => {
    if (tagNames.length > 0) {
        return tagNames.slice(0, 2).join(' + ');
    }

    if (propertyFilters.length > 0) {
        return propertyFilters
            .slice(0, 2)
            .map((filter) => filter.name)
            .join(' + ');
    }

    return 'All notes';
};

export const normalizeViewInput = (input: ViewInput) => {
    if (
        input.defaultTemplateNoteId !== undefined &&
        input.defaultTemplateNoteId !== null &&
        (!/^[1-9]\d*$/.test(input.defaultTemplateNoteId) || Number(input.defaultTemplateNoteId) > 2_147_483_647)
    ) {
        throw new InvalidNotePropertyInputError('Choose a valid template note.');
    }
    const tagNames = normalizeViewTagFilterNames(input.tagNames ?? []);
    const propertyFilters = normalizeViewPropertyFilters(input.propertyFilters);
    const trimmedTitle = input.title?.trim() ?? '';
    const sortBy = normalizeViewSortBy(input.sortBy);
    const sortOrder = normalizeViewSortOrder(input.sortOrder);
    const displayOptions = normalizeViewDisplayOptions(input.displayOptions);
    const displayType = normalizeViewDisplayType(input.displayType);

    if (displayType === 'board' && !displayOptions.boardGroupByPropertyKey) {
        throw new InvalidNotePropertyInputError('Board views require a grouping property.');
    }

    if (
        displayType === 'board' &&
        propertyFilters.some((filter) => filter.key === displayOptions.boardGroupByPropertyKey)
    ) {
        throw new InvalidNotePropertyInputError('A board grouping property cannot also be used as a view filter.');
    }

    if (
        displayType === 'calendar' &&
        displayOptions.calendarDateField === 'property' &&
        !displayOptions.calendarDatePropertyKey
    ) {
        throw new InvalidNotePropertyInputError('Calendar views require a date property.');
    }

    return {
        defaultTemplateNoteId: input.defaultTemplateNoteId,
        title: trimmedTitle || buildDefaultViewTitle(tagNames, propertyFilters),
        displayType,
        displayOptions,
        tagNames,
        mode: input.mode === 'or' ? 'or' : 'and',
        propertyFilters,
        sortBy,
        sortOrder,
        limit: clampViewLimit(input.limit),
    } satisfies {
        defaultTemplateNoteId?: string | null;
        title: string;
        displayType: ViewDisplayType;
        displayOptions: ViewDisplayOptionsRecord;
        tagNames: string[];
        mode: ViewTagFilterMatchMode;
        propertyFilters: ViewPropertyFilterRecord[];
        sortBy: ViewSortBy;
        sortOrder: ViewSortOrder;
        limit: number;
    };
};

export const normalizeViewNotesQueryInput = (input: ViewNotesQueryInput): ViewNotesQueryRecord => {
    return {
        tagNames: normalizeViewTagFilterNames(input.tagNames ?? []),
        mode: input.mode === 'or' ? 'or' : 'and',
        propertyFilters: normalizeViewPropertyFilters(input.propertyFilters),
        sortBy: normalizeViewSortBy(input.sortBy),
        sortOrder: normalizeViewSortOrder(input.sortOrder),
    };
};

export const normalizeViewNotesPagination = (pagination?: { limit?: number; offset?: number }) => {
    const numericLimit = Number(pagination?.limit ?? DEFAULT_VIEW_NOTES_QUERY_LIMIT);
    const limit = Number.isInteger(numericLimit)
        ? Math.min(MAX_VIEW_NOTES_QUERY_LIMIT, Math.max(1, numericLimit))
        : DEFAULT_VIEW_NOTES_QUERY_LIMIT;
    const numericOffset = Number(pagination?.offset ?? 0);
    const offset = Number.isInteger(numericOffset) ? Math.max(0, numericOffset) : 0;

    return { limit, offset };
};

export const pickNextActiveViewGroupId = (
    groupIds: number[],
    deletedGroupId: number,
    currentActiveGroupId: number | null,
) => {
    const remainingGroupIds = groupIds.filter((groupId) => groupId !== deletedGroupId);

    if (remainingGroupIds.length === 0) {
        return null;
    }

    if (currentActiveGroupId !== deletedGroupId) {
        return currentActiveGroupId;
    }

    return remainingGroupIds[0] ?? null;
};

const ensureValidReorderIds = (currentIds: number[], nextIds: number[]) => {
    if (currentIds.length !== nextIds.length) {
        throw new Error('Reorder payload must include every item exactly once.');
    }

    const currentIdSet = new Set(currentIds);
    const nextIdSet = new Set(nextIds);

    if (currentIdSet.size !== currentIds.length || nextIdSet.size !== nextIds.length) {
        throw new Error('Reorder payload contains duplicate ids.');
    }

    for (const id of currentIdSet) {
        if (!nextIdSet.has(id)) {
            throw new Error('Reorder payload must match the current item set.');
        }
    }
};

const parseViewId = (id: string) => {
    const numericId = Number(id);

    if (!Number.isInteger(numericId) || numericId <= 0) {
        throw new Error('A valid id is required.');
    }

    return numericId;
};

export const serializeView = (view: DbView): ViewRecord => {
    const query = parseStoredViewQuery(view.query);

    return {
        workspaceId: String(view.group.workspaceId),
        defaultTemplateNoteId: query.defaultTemplateNoteId ?? null,
        id: String(view.id),
        groupId: String(view.groupId),
        title: view.title,
        displayType: normalizeViewDisplayType(view.displayType as ViewDisplayType),
        displayOptions: query.displayOptions,
        tagNames: view.tagFilters.map((filter) => filter.tagName),
        mode: view.mode as ViewTagFilterMatchMode,
        propertyFilters: query.propertyFilters,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        limit: view.limit,
        order: view.order,
    };
};

const serializeViewGroup = (group: DbViewGroup): ViewGroupRecord => ({
    workspaceId: String(group.workspaceId),
    id: String(group.id),
    title: group.title,
    order: group.order,
    views: group.views.map(serializeView),
});

const getOrderedViewGroups = async (db: ViewDbClient, workspaceId = DEFAULT_WORKSPACE_ID) => {
    return db.viewGroup.findMany({
        where: { workspaceId },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        include: orderedViewGroupViewsInclude,
    });
};

const ensureViewWorkspace = async (db: ViewDbClient, workspaceId = DEFAULT_WORKSPACE_ID) => {
    return db.viewDashboardState.upsert({
        where: { workspaceId },
        update: {},
        create: { workspaceId },
    });
};

const readViewWorkspace = async (
    db: ViewDbClient,
    workspaceId = DEFAULT_WORKSPACE_ID,
): Promise<ViewWorkspaceRecord> => {
    const [workspace, groups] = await Promise.all([
        ensureViewWorkspace(db, workspaceId),
        getOrderedViewGroups(db, workspaceId),
    ]);

    const activeGroupId =
        workspace.activeGroupId !== null && groups.some((group) => group.id === workspace.activeGroupId)
            ? String(workspace.activeGroupId)
            : groups[0]
              ? String(groups[0].id)
              : null;

    return {
        activeGroupId,
        groups: groups.map(serializeViewGroup),
    };
};

const readView = async (db: ViewDbClient, id: number): Promise<ViewRecord | null> => {
    const view = await db.view.findUnique({
        where: { id },
        include: orderedViewTagFiltersInclude,
    });

    return view ? serializeView(view) : null;
};

export const hydratePropertyFilters = async (
    db: ViewDbClient,
    filters: ViewPropertyFilterRecord[],
    options: { validateSelectOptions?: boolean } = {},
) => {
    if (filters.length === 0) {
        return [];
    }

    const definitions = await db.propertyDefinition.findMany({
        where: { key: { in: filters.map((filter) => filter.key) } },
        select: {
            key: true,
            name: true,
            valueType: true,
            options: {
                select: {
                    value: true,
                },
            },
        },
    });
    const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));

    return filters.map((filter) => {
        const definition = definitionByKey.get(filter.key);

        if (!definition) {
            throw new InvalidNotePropertyInputError(`Property ${filter.key} is not defined.`);
        }

        if (definition.valueType !== filter.valueType) {
            throw new InvalidNotePropertyInputError(`Property ${filter.key} uses ${definition.valueType} values.`);
        }

        if (
            options.validateSelectOptions &&
            filter.valueType === 'select' &&
            filter.operator !== 'exists' &&
            filter.operator !== 'notExists'
        ) {
            const optionValue = normalizeSelectFilterValue(filter.value ?? '');

            if (!definition.options.some((option) => option.value === optionValue)) {
                throw new InvalidNotePropertyInputError(`Property ${filter.key} option ${optionValue} is not defined.`);
            }
        }

        return {
            ...filter,
            name: definition.name,
        };
    });
};

const buildStoredViewQuery = async (
    db: ViewDbClient,
    view: ReturnType<typeof normalizeViewInput>,
    workspaceId: number,
) => {
    const keys = [
        ...new Set(
            [
                ...view.propertyFilters.map((filter) => filter.key),
                ...view.displayOptions.tablePropertyKeys,
                view.displayOptions.boardGroupByPropertyKey,
                view.displayOptions.calendarDatePropertyKey,
            ].filter((key): key is string => Boolean(key)),
        ),
    ];
    for (const key of keys) {
        const definition = await db.propertyDefinition.findUnique({ where: { key } });
        if (!definition) throw new InvalidNotePropertyInputError(`Property ${key} is not defined.`);
        assertSameWorkspace(definition.workspaceId, workspaceId);
    }

    const propertyFilters = await hydratePropertyFilters(db, view.propertyFilters, { validateSelectOptions: true });

    if (view.displayType === 'board') {
        const groupingProperty = await db.propertyDefinition.findUnique({
            where: { key: view.displayOptions.boardGroupByPropertyKey ?? '' },
            select: { valueType: true, options: { select: { id: true }, take: 1 } },
        });

        if (!groupingProperty) {
            throw new InvalidNotePropertyInputError(
                `Property ${view.displayOptions.boardGroupByPropertyKey ?? ''} is not defined.`,
            );
        }

        if (groupingProperty.valueType !== 'select') {
            throw new InvalidNotePropertyInputError('Board views can only group by a select property.');
        }

        if (groupingProperty.options.length === 0) {
            throw new InvalidNotePropertyInputError('Board grouping properties require at least one option.');
        }
    }

    if (view.displayType === 'calendar' && view.displayOptions.calendarDateField === 'property') {
        const calendarDatePropertyKey = view.displayOptions.calendarDatePropertyKey ?? '';
        const calendarDateProperty = await db.propertyDefinition.findUnique({
            where: { key: calendarDatePropertyKey },
            select: { valueType: true },
        });

        if (!calendarDateProperty) {
            throw new InvalidNotePropertyInputError(`Property ${calendarDatePropertyKey} is not defined.`);
        }

        if (calendarDateProperty.valueType !== 'date') {
            throw new InvalidNotePropertyInputError('Calendar views can only use a date property.');
        }
    }

    return serializeStoredViewQuery({
        defaultTemplateNoteId: view.defaultTemplateNoteId,
        propertyFilters,
        sortBy: view.sortBy,
        sortOrder: view.sortOrder,
        displayOptions: view.displayOptions,
    });
};

const getNextGroupOrder = async (db: ViewDbClient, workspaceId: number) => {
    const lastGroup = await db.viewGroup.findFirst({
        where: { workspaceId },
        orderBy: [{ order: 'desc' }, { createdAt: 'desc' }],
        select: { order: true },
    });

    return lastGroup ? lastGroup.order + 1 : 0;
};

const getNextViewOrder = async (db: ViewDbClient, groupId: number) => {
    const lastView = await db.view.findFirst({
        where: { groupId },
        orderBy: [{ order: 'desc' }, { createdAt: 'desc' }],
        select: { order: true },
    });

    return lastView ? lastView.order + 1 : 0;
};

const resequenceViewGroups = async (db: ViewDbClient, workspaceId: number) => {
    const groups = await db.viewGroup.findMany({
        where: { workspaceId },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
    });

    await Promise.all(
        groups.map((group, index) =>
            db.viewGroup.update({
                where: { id: group.id },
                data: { order: index },
            }),
        ),
    );
};

const resequenceViews = async (db: ViewDbClient, groupId: number) => {
    const views = await db.view.findMany({
        where: { groupId },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
    });

    await Promise.all(
        views.map((view, index) =>
            db.view.update({
                where: { id: view.id },
                data: { order: index },
            }),
        ),
    );
};

export const getViewWorkspace = async (id: string | number = DEFAULT_WORKSPACE_ID) => {
    const workspaceId = parseWorkspaceId(id);
    await requireWorkspace(workspaceId);
    return readViewWorkspace(models, workspaceId);
};

export const getViewById = async (id: string, db: ViewDbClient = models) => {
    return readView(db, parseViewId(id));
};

const normalizeSelectFilterValue = (value: string) => {
    return value.trim().toLowerCase().replace(/\s+/g, '-');
};

const buildPropertyFilterValueWhere = (filter: ViewPropertyFilterRecord): Prisma.NotePropertyWhereInput => {
    switch (filter.valueType) {
        case 'number': {
            const numberValue = Number(filter.value);

            if (filter.operator === 'before') {
                return { numberValue: { lt: numberValue } };
            }

            if (filter.operator === 'after') {
                return { numberValue: { gt: numberValue } };
            }

            if (filter.operator === 'notEquals') {
                return { numberValue: { not: numberValue } };
            }

            return { numberValue };
        }
        case 'date': {
            const dateValue = new Date(`${filter.value}T00:00:00.000Z`);

            if (filter.operator === 'before') {
                return { dateValue: { lt: dateValue } };
            }

            if (filter.operator === 'after') {
                return { dateValue: { gt: dateValue } };
            }

            if (filter.operator === 'notEquals') {
                return { dateValue: { not: dateValue } };
            }

            return { dateValue };
        }
        case 'boolean': {
            if (filter.operator === 'notEquals') {
                return { boolValue: { not: filter.value === 'true' } };
            }

            return { boolValue: filter.value === 'true' };
        }
        case 'select':
            if (filter.operator === 'notEquals') {
                return { option: { is: { value: { not: normalizeSelectFilterValue(filter.value ?? '') } } } };
            }

            return { option: { is: { value: normalizeSelectFilterValue(filter.value ?? '') } } };
        case 'url':
        case 'text':
        default: {
            const textValue = filter.value?.toLowerCase() ?? '';

            if (filter.operator === 'notEquals') {
                return { textValueNormalized: { not: textValue } };
            }

            if (filter.operator === 'contains') {
                return { textValueNormalized: { contains: textValue } };
            }

            if (filter.operator === 'notContains') {
                return { textValueNormalized: { not: { contains: textValue } } };
            }

            return { textValueNormalized: textValue };
        }
    }
};

export const buildPropertyFilterWhere = (filter: ViewPropertyFilterRecord): Prisma.NoteWhereInput => {
    const definitionWhere = {
        definition: {
            is: {
                key: filter.key,
            },
        },
    } satisfies Prisma.NotePropertyWhereInput;

    if (filter.operator === 'notExists') {
        return {
            properties: {
                none: definitionWhere,
            },
        };
    }

    if (filter.operator === 'exists') {
        return {
            properties: {
                some: definitionWhere,
            },
        };
    }

    return {
        properties: {
            some: {
                ...definitionWhere,
                ...buildPropertyFilterValueWhere(filter),
            },
        },
    };
};

export const buildViewNotesWhere = (
    query: Pick<ViewNotesQueryRecord, 'tagNames' | 'mode' | 'propertyFilters'>,
): Prisma.NoteWhereInput => {
    const clauses: Prisma.NoteWhereInput[] = [];

    if (query.tagNames.length > 0) {
        clauses.push(buildNoteTagNamesWhere(query.tagNames, query.mode as NoteTagMatchMode));
    }

    for (const filter of query.propertyFilters) {
        clauses.push(buildPropertyFilterWhere(filter));
    }

    if (clauses.length === 0) {
        return {};
    }

    return { AND: clauses };
};

export const buildViewWhere = (view: ViewRecord): Prisma.NoteWhereInput => {
    return { workspaceId: Number(view.workspaceId), ...buildViewNotesWhere(view) };
};

export const normalizeViewCalendarDateRange = (dateRange: ViewCalendarDateRangeInput) => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const duration = end.getTime() - start.getTime();

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        duration <= 0 ||
        duration > MAX_VIEW_CALENDAR_RANGE_MS
    ) {
        throw new InvalidNotePropertyInputError('Calendar date range must be valid and cover no more than 32 days.');
    }

    return { start, end };
};

export const buildViewCalendarWhere = (
    view: ViewRecord,
    dateRange: { start: Date; end: Date },
    propertyDefinitionId?: number,
): Prisma.NoteWhereInput => {
    const viewWhere = buildViewWhere(view);

    if (view.displayOptions.calendarDateField === 'property' && propertyDefinitionId === undefined) {
        throw new InvalidNotePropertyInputError('Calendar date property definition is required.');
    }

    const dateWhere: Prisma.NoteWhereInput =
        view.displayOptions.calendarDateField === 'property'
            ? {
                  properties: {
                      some: {
                          propertyDefinitionId,
                          dateValue: {
                              gte: dateRange.start,
                              lt: dateRange.end,
                          },
                      },
                  },
              }
            : {
                  [view.displayOptions.calendarDateField]: {
                      gte: dateRange.start,
                      lt: dateRange.end,
                  },
              };

    return Object.keys(viewWhere).length === 0 ? dateWhere : { AND: [viewWhere, dateWhere] };
};

export const buildViewBoardColumnWhere = (
    view: ViewRecord,
    propertyDefinitionId: number,
    optionId: number | null,
): Prisma.NoteWhereInput => {
    const viewWhere = buildViewWhere(view);
    const columnWhere: Prisma.NoteWhereInput =
        optionId === null
            ? {
                  properties: {
                      none: { propertyDefinitionId },
                  },
              }
            : {
                  properties: {
                      some: { propertyDefinitionId, optionId },
                  },
              };

    return Object.keys(viewWhere).length === 0 ? columnWhere : { AND: [viewWhere, columnWhere] };
};

const buildViewNotesOrderBy = (
    query: Pick<ViewNotesQueryRecord, 'sortBy' | 'sortOrder'>,
): Prisma.NoteOrderByWithRelationInput[] => {
    return [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }];
};

const buildViewOrderBy = (view: ViewRecord): Prisma.NoteOrderByWithRelationInput[] => {
    return buildViewNotesOrderBy(view);
};

export const getViewNotes = async (
    id: string,
    pagination: {
        limit: number;
        offset: number;
    },
    sort: Pick<ViewNotesQueryInput, 'sortBy' | 'sortOrder'> = {},
): Promise<ViewNotesResult | null> => {
    const view = await models.view.findUnique({
        where: { id: parseViewId(id) },
        include: orderedViewTagFiltersInclude,
    });

    if (!view) {
        return null;
    }

    const serializedView = serializeView(view);
    const where = buildViewWhere(serializedView);
    const effectiveSort = {
        sortBy: sort.sortBy ?? serializedView.sortBy,
        sortOrder: sort.sortOrder ?? serializedView.sortOrder,
    };

    const [totalCount, notes] = await Promise.all([
        models.note.count({ where }),
        models.note.findMany({
            orderBy: buildViewNotesOrderBy(effectiveSort),
            where,
            take: Number(pagination.limit),
            skip: Number(pagination.offset),
        }),
    ]);

    return {
        totalCount,
        notes,
    };
};

export const getViewCalendarNotes = async (
    id: string,
    dateRangeInput: ViewCalendarDateRangeInput,
): Promise<ViewCalendarNote[] | null> => {
    const view = await models.view.findUnique({
        where: { id: parseViewId(id) },
        include: orderedViewTagFiltersInclude,
    });

    if (!view) {
        return null;
    }

    const serializedView = serializeView(view);

    if (serializedView.displayType !== 'calendar') {
        throw new InvalidNotePropertyInputError('This view is not configured as a calendar.');
    }

    const dateRange = normalizeViewCalendarDateRange(dateRangeInput);
    const dateField = serializedView.displayOptions.calendarDateField;

    if (dateField === 'property') {
        const propertyKey = serializedView.displayOptions.calendarDatePropertyKey;
        const propertyDefinition = propertyKey
            ? await models.propertyDefinition.findUnique({
                  where: { key: propertyKey },
                  select: { id: true, valueType: true },
              })
            : null;

        if (!propertyDefinition || propertyDefinition.valueType !== 'date') {
            throw new InvalidNotePropertyInputError('The calendar date property is unavailable.');
        }

        const notes = await models.note.findMany({
            orderBy: [{ id: 'asc' }],
            where: buildViewCalendarWhere(serializedView, dateRange, propertyDefinition.id),
            select: {
                id: true,
                title: true,
                properties: {
                    where: { propertyDefinitionId: propertyDefinition.id },
                    select: { dateValue: true },
                    take: 1,
                },
            },
        });

        return notes
            .flatMap((note): ViewCalendarNote[] => {
                const dateValue = note.properties[0]?.dateValue;

                return dateValue
                    ? [{ id: note.id, title: note.title, calendarDate: dateValue.toISOString().slice(0, 10) }]
                    : [];
            })
            .sort((left, right) => left.calendarDate.localeCompare(right.calendarDate) || left.id - right.id);
    }

    const notes = await models.note.findMany({
        orderBy: [{ [dateField]: 'asc' }, { id: 'asc' }],
        where: buildViewCalendarWhere(serializedView, dateRange),
        select: {
            id: true,
            title: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return notes.map((note) => ({
        id: note.id,
        title: note.title,
        calendarDate: note[dateField].toISOString(),
    }));
};

export const getViewBoardColumn = async (
    id: string,
    optionValue: string | null,
    pagination?: {
        limit?: number;
        offset?: number;
    },
): Promise<ViewBoardColumnNotesResult | null> => {
    const view = await models.view.findUnique({
        where: { id: parseViewId(id) },
        include: orderedViewTagFiltersInclude,
    });

    if (!view) {
        return null;
    }

    const serializedView = serializeView(view);

    if (serializedView.displayType !== 'board') {
        throw new InvalidNotePropertyInputError('This view is not configured as a board.');
    }

    const groupingPropertyKey = serializedView.displayOptions.boardGroupByPropertyKey;

    if (!groupingPropertyKey) {
        throw new InvalidNotePropertyInputError('Board views require a grouping property.');
    }

    const groupingProperty = await models.propertyDefinition.findUnique({
        where: { key: groupingPropertyKey },
        select: {
            id: true,
            valueType: true,
            options: {
                orderBy: [{ order: 'asc' }, { id: 'asc' }],
                select: { id: true, value: true },
            },
        },
    });

    if (!groupingProperty || groupingProperty.valueType !== 'select') {
        throw new InvalidNotePropertyInputError('The board grouping property is unavailable.');
    }

    const normalizedOptionValue = optionValue === null ? null : normalizeSelectFilterValue(optionValue);
    const option =
        normalizedOptionValue === null
            ? null
            : groupingProperty.options.find((candidate) => candidate.value === normalizedOptionValue);

    if (normalizedOptionValue !== null && !option) {
        throw new InvalidNotePropertyInputError(
            `Property ${groupingPropertyKey} option ${normalizedOptionValue} is not defined.`,
        );
    }

    const normalizedPagination = normalizeViewNotesPagination(pagination);
    const where = buildViewBoardColumnWhere(serializedView, groupingProperty.id, option?.id ?? null);

    const [totalCount, notes] = await Promise.all([
        models.note.count({ where }),
        models.note.findMany({
            orderBy: buildViewOrderBy(serializedView),
            where,
            take: normalizedPagination.limit,
            skip: normalizedPagination.offset,
            select: {
                id: true,
                title: true,
                updatedAt: true,
            },
        }),
    ]);

    return { totalCount, notes };
};

export const getNotesByQueryWithDb = async (
    db: ViewDbClient,
    input: ViewNotesQueryInput,
    pagination?: {
        limit?: number;
        offset?: number;
    },
) => {
    const normalizedQuery = normalizeViewNotesQueryInput(input);

    const query = {
        ...normalizedQuery,
        propertyFilters: await hydratePropertyFilters(db, normalizedQuery.propertyFilters, {
            validateSelectOptions: true,
        }),
    };
    const normalizedPagination = normalizeViewNotesPagination(pagination);
    const scopeWhere = await resolveWorkspaceWhere(input.scope, db);
    const where = { ...scopeWhere, ...buildViewNotesWhere(query) };

    const [totalCount, notes] = await Promise.all([
        db.note.count({ where }),
        db.note.findMany({
            orderBy: buildViewNotesOrderBy(query),
            where,
            take: normalizedPagination.limit,
            skip: normalizedPagination.offset,
        }),
    ]);

    return {
        resolvedScope: resolvedWorkspaceScope(scopeWhere),
        query,
        totalCount,
        notes,
    };
};

export const getNotesByPropertiesWithDb = async (
    db: ViewDbClient,
    input: ViewNotesQueryInput,
    pagination?: { limit?: number; offset?: number },
): Promise<ViewNotesResult> => {
    if (!input.propertyFilters?.length) {
        throw new InvalidNotePropertyInputError('At least one property filter is required.');
    }
    return getNotesByQueryWithDb(db, input, pagination);
};

export const getNotesByQuery = (input: ViewNotesQueryInput, pagination?: { limit?: number; offset?: number }) =>
    getNotesByQueryWithDb(models, input, pagination);

export const getNotesByProperties = async (
    input: ViewNotesQueryInput,
    pagination?: {
        limit?: number;
        offset?: number;
    },
): Promise<ViewNotesResult> => {
    return getNotesByPropertiesWithDb(models, input, pagination);
};

export const createViewGroup = async (title: string, id: string | number = DEFAULT_WORKSPACE_ID) => {
    const workspaceId = parseWorkspaceId(id);
    return models.$transaction(async (tx) => {
        await requireWorkspace(workspaceId, tx, true);
        const workspace = await ensureViewWorkspace(tx, workspaceId);
        const nextGroupOrder = await getNextGroupOrder(tx, workspaceId);
        const createdGroup = await tx.viewGroup.create({
            data: {
                workspaceId,
                title: normalizeViewGroupTitle(title),
                order: nextGroupOrder,
            },
            include: orderedViewGroupViewsInclude,
        });

        if (workspace.activeGroupId === null) {
            await tx.viewDashboardState.update({
                where: { workspaceId },
                data: { activeGroupId: createdGroup.id },
            });
        }

        return serializeViewGroup(createdGroup);
    });
};

export const updateViewGroup = async (id: string, title: string) => {
    const updatedGroup = await models.$transaction(async (tx) => {
        const group = await tx.viewGroup.findUniqueOrThrow({ where: { id: parseViewId(id) } });
        await requireWorkspace(group.workspaceId, tx, true);
        return tx.viewGroup.update({
            where: { id: parseViewId(id) },
            data: {
                title: normalizeViewGroupTitle(title),
            },
            include: orderedViewGroupViewsInclude,
        });
    });

    return serializeViewGroup(updatedGroup);
};

export const deleteViewGroup = async (id: string) => {
    const groupId = parseViewId(id);

    return models.$transaction(async (tx) => {
        const original = await tx.viewGroup.findUnique({ where: { id: groupId } });
        if (!original) return false;
        const workspaceId = original.workspaceId;
        await requireWorkspace(workspaceId, tx, true);
        const workspace = await ensureViewWorkspace(tx, workspaceId);
        const groups = await tx.viewGroup.findMany({
            where: { workspaceId },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { id: true },
        });

        if (!groups.some((group) => group.id === groupId)) {
            return false;
        }

        await tx.viewGroup.delete({ where: { id: groupId } });
        await resequenceViewGroups(tx, workspaceId);

        const nextActiveGroupId = pickNextActiveViewGroupId(
            groups.map((group) => group.id),
            groupId,
            workspace.activeGroupId,
        );

        await tx.viewDashboardState.update({
            where: { workspaceId },
            data: { activeGroupId: nextActiveGroupId },
        });

        return true;
    });
};

export const setActiveViewGroup = async (id: string) => {
    const groupId = parseViewId(id);

    return models.$transaction(async (tx) => {
        const group = await tx.viewGroup.findUnique({
            where: { id: groupId },
            select: { id: true, workspaceId: true },
        });

        if (!group) {
            throw new Error('View group not found.');
        }

        const workspace = await ensureViewWorkspace(tx, group.workspaceId);
        await tx.viewDashboardState.update({
            where: { workspaceId: workspace.workspaceId },
            data: { activeGroupId: groupId },
        });

        return readViewWorkspace(tx, group.workspaceId);
    });
};

export const reorderViewGroups = async (groupIds: string[], id: string | number = DEFAULT_WORKSPACE_ID) => {
    const workspaceId = parseWorkspaceId(id);
    const nextGroupIds = groupIds.map(parseViewId);

    return models.$transaction(async (tx) => {
        await requireWorkspace(workspaceId, tx, true);
        const groups = await tx.viewGroup.findMany({
            where: { workspaceId },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { id: true },
        });
        const currentGroupIds = groups.map((group) => group.id);

        ensureValidReorderIds(currentGroupIds, nextGroupIds);

        await Promise.all(
            nextGroupIds.map((groupId, index) =>
                tx.viewGroup.update({
                    where: { id: groupId },
                    data: { order: index },
                }),
            ),
        );

        const reorderedGroups = await getOrderedViewGroups(tx, workspaceId);
        return reorderedGroups.map(serializeViewGroup);
    });
};

const assertTemplateNoteExists = async (db: ViewDbClient, workspaceId: number, id?: string | null) => {
    if (!id) return;
    const note = await db.note.findUnique({ where: { id: Number(id) } });
    if (!note) throw new InvalidNotePropertyInputError('The selected template note is unavailable.');
    assertSameWorkspace(note.workspaceId, workspaceId);
};

export const createView = async (groupId: string, input: ViewInput) => {
    const numericGroupId = parseViewId(groupId);
    const nextView = normalizeViewInput(input);

    return models.$transaction(async (tx) => {
        const group = await tx.viewGroup.findUnique({
            where: { id: numericGroupId },
            select: { id: true, workspaceId: true },
        });

        if (!group) {
            throw new Error('View group not found.');
        }

        await requireWorkspace(group.workspaceId, tx, true);
        const nextViewOrder = await getNextViewOrder(tx, numericGroupId);
        await assertTemplateNoteExists(tx, group.workspaceId, nextView.defaultTemplateNoteId);
        const query = await buildStoredViewQuery(tx, nextView, group.workspaceId);

        const createdView = await tx.view.create({
            data: {
                groupId: numericGroupId,
                title: nextView.title,
                displayType: nextView.displayType,
                query,
                mode: nextView.mode,
                limit: nextView.limit,
                order: nextViewOrder,
                tagFilters: {
                    create: nextView.tagNames.map((tagName, index) => ({
                        tagName,
                        order: index,
                    })),
                },
            },
            include: orderedViewTagFiltersInclude,
        });

        return serializeView(createdView);
    });
};

export const updateView = async (id: string, input: ViewInput) => {
    const viewId = parseViewId(id);
    const nextView = normalizeViewInput(input);

    return models.$transaction(async (tx) => {
        const existing = await tx.view.findUniqueOrThrow({ where: { id: viewId }, include: { group: true } });
        await requireWorkspace(existing.group.workspaceId, tx, true);
        const previousTemplateId = parseStoredViewQuery(existing.query).defaultTemplateNoteId ?? null;
        const defaultTemplateNoteId =
            input.defaultTemplateNoteId === undefined ? previousTemplateId : input.defaultTemplateNoteId;
        if (defaultTemplateNoteId !== previousTemplateId)
            await assertTemplateNoteExists(tx, existing.group.workspaceId, defaultTemplateNoteId);
        const query = await buildStoredViewQuery(
            tx,
            { ...nextView, defaultTemplateNoteId },
            existing.group.workspaceId,
        );

        const updatedView = await tx.view.update({
            where: { id: viewId },
            data: {
                title: nextView.title,
                displayType: nextView.displayType,
                query,
                mode: nextView.mode,
                limit: nextView.limit,
                tagFilters: {
                    deleteMany: {},
                    create: nextView.tagNames.map((tagName, index) => ({
                        tagName,
                        order: index,
                    })),
                },
            },
            include: orderedViewTagFiltersInclude,
        });

        return serializeView(updatedView);
    });
};

export const deleteView = async (id: string) => {
    const viewId = parseViewId(id);

    return models.$transaction(async (tx) => {
        const view = await tx.view.findUnique({
            where: { id: viewId },
            select: { id: true, groupId: true },
        });

        if (!view) {
            return false;
        }

        const group = await tx.viewGroup.findUniqueOrThrow({ where: { id: view.groupId } });
        await requireWorkspace(group.workspaceId, tx, true);
        await tx.view.delete({
            where: { id: viewId },
        });
        await resequenceViews(tx, view.groupId);

        return true;
    });
};

export const reorderViews = async (groupId: string, viewIds: string[]) => {
    const numericGroupId = parseViewId(groupId);
    const nextViewIds = viewIds.map(parseViewId);

    return models.$transaction(async (tx) => {
        const group = await tx.viewGroup.findUniqueOrThrow({ where: { id: numericGroupId } });
        await requireWorkspace(group.workspaceId, tx, true);
        const views = await tx.view.findMany({
            where: { groupId: numericGroupId },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { id: true },
        });
        const currentViewIds = views.map((view) => view.id);

        ensureValidReorderIds(currentViewIds, nextViewIds);

        await Promise.all(
            nextViewIds.map((viewId, index) =>
                tx.view.update({
                    where: { id: viewId },
                    data: { order: index },
                }),
            ),
        );

        const reorderedViews = await tx.view.findMany({
            where: { groupId: numericGroupId },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            include: orderedViewTagFiltersInclude,
        });

        return reorderedViews.map(serializeView);
    });
};
