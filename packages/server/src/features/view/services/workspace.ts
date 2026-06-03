import type { Note, Prisma, PropertyValueType } from '@prisma/client';
import {
    InvalidNotePropertyInputError,
    normalizePropertyKey,
    normalizeUrlValue,
} from '~/features/note/services/properties.js';
import { buildNoteTagNamesWhere, type NoteTagMatchMode } from '~/features/note/services/tag-filter.js';
import models from '~/models.js';

export type ViewTagMatchMode = NoteTagMatchMode;
export type ViewDisplayType = 'list' | 'table' | 'calendar';
export type ViewTableColumn = 'title' | 'tags' | 'properties' | 'createdAt' | 'updatedAt';
export type ViewPropertyFilterOperator = 'equals' | 'before' | 'after' | 'exists' | 'notExists';
export type ViewSortBy = 'updatedAt' | 'createdAt' | 'title';
export type ViewSortOrder = 'asc' | 'desc';

export interface ViewDisplayOptionsRecord {
    tableColumns: ViewTableColumn[];
}

export interface ViewPropertyFilterRecord {
    key: string;
    name: string;
    valueType: PropertyValueType;
    operator: ViewPropertyFilterOperator;
    value: string | null;
}

export interface ViewSectionRecord {
    id: string;
    tabId: string;
    title: string;
    displayType: ViewDisplayType;
    displayOptions: ViewDisplayOptionsRecord;
    tagNames: string[];
    mode: ViewTagMatchMode;
    propertyFilters: ViewPropertyFilterRecord[];
    sortBy: ViewSortBy;
    sortOrder: ViewSortOrder;
    limit: number;
    order: number;
}

export interface ViewTabRecord {
    id: string;
    title: string;
    order: number;
    sections: ViewSectionRecord[];
}

export interface ViewWorkspaceRecord {
    activeTabId: string | null;
    tabs: ViewTabRecord[];
}

export interface ViewSectionInput {
    title?: string;
    displayType?: ViewDisplayType;
    displayOptions?: ViewDisplayOptionsInput | null;
    tagNames?: string[] | null;
    mode?: ViewTagMatchMode;
    propertyFilters?: ViewPropertyFilterInput[] | null;
    sortBy?: ViewSortBy;
    sortOrder?: ViewSortOrder;
    limit?: number;
}

export interface ViewNotesQueryInput {
    tagNames?: string[] | null;
    mode?: ViewTagMatchMode;
    propertyFilters?: ViewPropertyFilterInput[] | null;
    sortBy?: ViewSortBy;
    sortOrder?: ViewSortOrder;
}

export interface ViewNotesQueryRecord {
    tagNames: string[];
    mode: ViewTagMatchMode;
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
}

export interface ViewSectionNotesResult {
    totalCount: number;
    notes: Note[];
}

const VIEW_WORKSPACE_ID = 1;

export const DEFAULT_VIEW_SECTION_LIMIT = 5;
export const MIN_VIEW_SECTION_LIMIT = 1;
export const MAX_VIEW_SECTION_LIMIT = 20;
export const DEFAULT_VIEW_NOTES_QUERY_LIMIT = 20;
export const MAX_VIEW_NOTES_QUERY_LIMIT = 50;
const MAX_VIEW_PROPERTY_FILTERS = 10;
const DEFAULT_VIEW_DISPLAY_TYPE: ViewDisplayType = 'list';
const DEFAULT_VIEW_SORT_BY: ViewSortBy = 'updatedAt';
const DEFAULT_VIEW_SORT_ORDER: ViewSortOrder = 'desc';
const DEFAULT_VIEW_TABLE_COLUMNS: ViewTableColumn[] = ['title', 'tags', 'properties', 'createdAt', 'updatedAt'];

type ViewDbClient = typeof models | Prisma.TransactionClient;

const orderedViewSectionTagsInclude = {
    tags: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    },
} satisfies Prisma.ViewSectionInclude;

const orderedViewTabSectionsInclude = {
    sections: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        include: orderedViewSectionTagsInclude,
    },
} satisfies Prisma.ViewTabInclude;

type DbViewSection = Prisma.ViewSectionGetPayload<{
    include: typeof orderedViewSectionTagsInclude;
}>;

type DbViewTab = Prisma.ViewTabGetPayload<{
    include: typeof orderedViewTabSectionsInclude;
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
        return `@${trimmedValue.slice(1)}`;
    }

    return `@${trimmedValue}`;
};

export const normalizeViewTagNames = (values: string[]) => {
    const normalizedTagNames = values.flatMap((value) => value.split(','));

    return Array.from(new Set(normalizedTagNames.map(normalizeTagName).filter(Boolean)));
};

interface StoredViewQuery {
    propertyFilters?: ViewPropertyFilterRecord[];
    sortBy?: ViewSortBy;
    sortOrder?: ViewSortOrder;
    displayOptions?: Partial<ViewDisplayOptionsRecord>;
}

interface ParsedStoredViewQuery {
    propertyFilters: ViewPropertyFilterRecord[];
    sortBy: ViewSortBy;
    sortOrder: ViewSortOrder;
    displayOptions: ViewDisplayOptionsRecord;
}

const isViewPropertyFilterOperator = (value: unknown): value is ViewPropertyFilterOperator => {
    return value === 'equals' || value === 'before' || value === 'after' || value === 'exists' || value === 'notExists';
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
    if (value === 'table' || value === 'calendar') {
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

export const normalizeViewDisplayOptions = (
    options: ViewDisplayOptionsInput | Partial<ViewDisplayOptionsRecord> | null | undefined,
): ViewDisplayOptionsRecord => {
    return {
        tableColumns: normalizeViewTableColumns(options?.tableColumns),
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

    if (valueType === 'url') {
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

const serializeStoredViewQuery = ({ propertyFilters, sortBy, sortOrder, displayOptions }: ParsedStoredViewQuery) => {
    return JSON.stringify({
        propertyFilters,
        sortBy,
        sortOrder,
        displayOptions,
    });
};

export const clampViewSectionLimit = (value: number | undefined) => {
    const numericValue = typeof value === 'number' ? value : Number.NaN;

    if (!Number.isInteger(numericValue)) {
        return DEFAULT_VIEW_SECTION_LIMIT;
    }

    return Math.min(MAX_VIEW_SECTION_LIMIT, Math.max(MIN_VIEW_SECTION_LIMIT, numericValue));
};

export const normalizeViewTabTitle = (title: string) => {
    const trimmedTitle = title.trim();

    return trimmedTitle || 'Untitled View';
};

const buildDefaultSectionTitle = (tagNames: string[], propertyFilters: ViewPropertyFilterRecord[]) => {
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

export const normalizeViewSectionInput = (input: ViewSectionInput) => {
    const tagNames = normalizeViewTagNames(input.tagNames ?? []);
    const propertyFilters = normalizeViewPropertyFilters(input.propertyFilters);
    const trimmedTitle = input.title?.trim() ?? '';
    const sortBy = normalizeViewSortBy(input.sortBy);
    const sortOrder = normalizeViewSortOrder(input.sortOrder);
    const displayOptions = normalizeViewDisplayOptions(input.displayOptions);

    return {
        title: trimmedTitle || buildDefaultSectionTitle(tagNames, propertyFilters),
        displayType: normalizeViewDisplayType(input.displayType),
        displayOptions,
        tagNames,
        mode: input.mode === 'or' ? 'or' : 'and',
        propertyFilters,
        sortBy,
        sortOrder,
        limit: clampViewSectionLimit(input.limit),
    } satisfies {
        title: string;
        displayType: ViewDisplayType;
        displayOptions: ViewDisplayOptionsRecord;
        tagNames: string[];
        mode: ViewTagMatchMode;
        propertyFilters: ViewPropertyFilterRecord[];
        sortBy: ViewSortBy;
        sortOrder: ViewSortOrder;
        limit: number;
    };
};

export const normalizeViewNotesQueryInput = (input: ViewNotesQueryInput): ViewNotesQueryRecord => {
    return {
        tagNames: normalizeViewTagNames(input.tagNames ?? []),
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

export const pickNextActiveViewTabId = (tabIds: number[], deletedTabId: number, currentActiveTabId: number | null) => {
    const remainingTabIds = tabIds.filter((tabId) => tabId !== deletedTabId);

    if (remainingTabIds.length === 0) {
        return null;
    }

    if (currentActiveTabId !== deletedTabId) {
        return currentActiveTabId;
    }

    return remainingTabIds[0] ?? null;
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

const serializeViewSection = (section: DbViewSection): ViewSectionRecord => {
    const query = parseStoredViewQuery(section.query);

    return {
        id: String(section.id),
        tabId: String(section.tabId),
        title: section.title,
        displayType: normalizeViewDisplayType(section.displayType as ViewDisplayType),
        displayOptions: query.displayOptions,
        tagNames: section.tags.map((tag) => tag.name),
        mode: section.mode as ViewTagMatchMode,
        propertyFilters: query.propertyFilters,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        limit: section.limit,
        order: section.order,
    };
};

const serializeViewTab = (tab: DbViewTab): ViewTabRecord => ({
    id: String(tab.id),
    title: tab.title,
    order: tab.order,
    sections: tab.sections.map(serializeViewSection),
});

const getOrderedViewTabs = async (db: ViewDbClient) => {
    return db.viewTab.findMany({
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        include: orderedViewTabSectionsInclude,
    });
};

const ensureViewWorkspace = async (db: ViewDbClient) => {
    return db.viewWorkspace.upsert({
        where: { id: VIEW_WORKSPACE_ID },
        update: {},
        create: { id: VIEW_WORKSPACE_ID },
    });
};

const readViewWorkspace = async (db: ViewDbClient): Promise<ViewWorkspaceRecord> => {
    const [workspace, tabs] = await Promise.all([ensureViewWorkspace(db), getOrderedViewTabs(db)]);

    const activeTabId =
        workspace.activeTabId !== null && tabs.some((tab) => tab.id === workspace.activeTabId)
            ? String(workspace.activeTabId)
            : tabs[0]
              ? String(tabs[0].id)
              : null;

    return {
        activeTabId,
        tabs: tabs.map(serializeViewTab),
    };
};

const readViewSection = async (db: ViewDbClient, id: number): Promise<ViewSectionRecord | null> => {
    const section = await db.viewSection.findUnique({
        where: { id },
        include: orderedViewSectionTagsInclude,
    });

    return section ? serializeViewSection(section) : null;
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

const buildStoredViewQuery = async (db: ViewDbClient, section: ReturnType<typeof normalizeViewSectionInput>) => {
    const propertyFilters = await hydratePropertyFilters(db, section.propertyFilters, { validateSelectOptions: true });

    return serializeStoredViewQuery({
        propertyFilters,
        sortBy: section.sortBy,
        sortOrder: section.sortOrder,
        displayOptions: section.displayOptions,
    });
};

const getNextTabOrder = async (db: ViewDbClient) => {
    const lastTab = await db.viewTab.findFirst({
        orderBy: [{ order: 'desc' }, { createdAt: 'desc' }],
        select: { order: true },
    });

    return lastTab ? lastTab.order + 1 : 0;
};

const getNextSectionOrder = async (db: ViewDbClient, tabId: number) => {
    const lastSection = await db.viewSection.findFirst({
        where: { tabId },
        orderBy: [{ order: 'desc' }, { createdAt: 'desc' }],
        select: { order: true },
    });

    return lastSection ? lastSection.order + 1 : 0;
};

const resequenceViewTabs = async (db: ViewDbClient) => {
    const tabs = await db.viewTab.findMany({
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
    });

    await Promise.all(
        tabs.map((tab, index) =>
            db.viewTab.update({
                where: { id: tab.id },
                data: { order: index },
            }),
        ),
    );
};

const resequenceViewSections = async (db: ViewDbClient, tabId: number) => {
    const sections = await db.viewSection.findMany({
        where: { tabId },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
    });

    await Promise.all(
        sections.map((section, index) =>
            db.viewSection.update({
                where: { id: section.id },
                data: { order: index },
            }),
        ),
    );
};

export const getViewWorkspace = async () => {
    return readViewWorkspace(models);
};

export const getViewSectionById = async (id: string) => {
    return readViewSection(models, parseViewId(id));
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

            return { dateValue };
        }
        case 'boolean':
            return { boolValue: filter.value === 'true' };
        case 'select':
            return { option: { is: { value: normalizeSelectFilterValue(filter.value ?? '') } } };
        case 'url':
        case 'text':
        default:
            return { textValueNormalized: filter.value?.toLowerCase() ?? '' };
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

export const buildViewSectionWhere = (section: ViewSectionRecord): Prisma.NoteWhereInput => {
    return buildViewNotesWhere(section);
};

const buildViewNotesOrderBy = (
    query: Pick<ViewNotesQueryRecord, 'sortBy' | 'sortOrder'>,
): Prisma.NoteOrderByWithRelationInput[] => {
    return [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }];
};

const buildViewSectionOrderBy = (section: ViewSectionRecord): Prisma.NoteOrderByWithRelationInput[] => {
    return buildViewNotesOrderBy(section);
};

export const getViewSectionNotes = async (
    id: string,
    pagination: {
        limit: number;
        offset: number;
    },
): Promise<ViewSectionNotesResult | null> => {
    const section = await models.viewSection.findUnique({
        where: { id: parseViewId(id) },
        include: orderedViewSectionTagsInclude,
    });

    if (!section) {
        return null;
    }

    const serializedSection = serializeViewSection(section);
    const where = buildViewSectionWhere(serializedSection);

    const [totalCount, notes] = await Promise.all([
        models.note.count({ where }),
        models.note.findMany({
            orderBy: buildViewSectionOrderBy(serializedSection),
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

export const getNotesByProperties = async (
    input: ViewNotesQueryInput,
    pagination?: {
        limit?: number;
        offset?: number;
    },
): Promise<ViewSectionNotesResult> => {
    const normalizedQuery = normalizeViewNotesQueryInput(input);

    if (normalizedQuery.propertyFilters.length === 0) {
        throw new InvalidNotePropertyInputError('At least one property filter is required.');
    }

    const query = {
        ...normalizedQuery,
        propertyFilters: await hydratePropertyFilters(models, normalizedQuery.propertyFilters, {
            validateSelectOptions: true,
        }),
    };
    const normalizedPagination = normalizeViewNotesPagination(pagination);
    const where = buildViewNotesWhere(query);

    const [totalCount, notes] = await Promise.all([
        models.note.count({ where }),
        models.note.findMany({
            orderBy: buildViewNotesOrderBy(query),
            where,
            take: normalizedPagination.limit,
            skip: normalizedPagination.offset,
        }),
    ]);

    return {
        totalCount,
        notes,
    };
};

export const createViewTab = async (title: string) => {
    return models.$transaction(async (tx) => {
        const workspace = await ensureViewWorkspace(tx);
        const nextTabOrder = await getNextTabOrder(tx);
        const createdTab = await tx.viewTab.create({
            data: {
                title: normalizeViewTabTitle(title),
                order: nextTabOrder,
            },
            include: orderedViewTabSectionsInclude,
        });

        if (workspace.activeTabId === null) {
            await tx.viewWorkspace.update({
                where: { id: VIEW_WORKSPACE_ID },
                data: { activeTabId: createdTab.id },
            });
        }

        return serializeViewTab(createdTab);
    });
};

export const updateViewTab = async (id: string, title: string) => {
    const updatedTab = await models.viewTab.update({
        where: { id: parseViewId(id) },
        data: {
            title: normalizeViewTabTitle(title),
        },
        include: orderedViewTabSectionsInclude,
    });

    return serializeViewTab(updatedTab);
};

export const deleteViewTab = async (id: string) => {
    const tabId = parseViewId(id);

    return models.$transaction(async (tx) => {
        const workspace = await ensureViewWorkspace(tx);
        const tabs = await tx.viewTab.findMany({
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { id: true },
        });

        if (!tabs.some((tab) => tab.id === tabId)) {
            return false;
        }

        await tx.viewTab.delete({ where: { id: tabId } });
        await resequenceViewTabs(tx);

        const nextActiveTabId = pickNextActiveViewTabId(
            tabs.map((tab) => tab.id),
            tabId,
            workspace.activeTabId,
        );

        await tx.viewWorkspace.update({
            where: { id: VIEW_WORKSPACE_ID },
            data: { activeTabId: nextActiveTabId },
        });

        return true;
    });
};

export const setActiveViewTab = async (id: string) => {
    const tabId = parseViewId(id);

    return models.$transaction(async (tx) => {
        const workspace = await ensureViewWorkspace(tx);
        const tab = await tx.viewTab.findUnique({
            where: { id: tabId },
            select: { id: true },
        });

        if (!tab) {
            throw new Error('View tab not found.');
        }

        await tx.viewWorkspace.update({
            where: { id: workspace.id },
            data: { activeTabId: tabId },
        });

        return readViewWorkspace(tx);
    });
};

export const reorderViewTabs = async (tabIds: string[]) => {
    const nextTabIds = tabIds.map(parseViewId);

    return models.$transaction(async (tx) => {
        const tabs = await tx.viewTab.findMany({
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { id: true },
        });
        const currentTabIds = tabs.map((tab) => tab.id);

        ensureValidReorderIds(currentTabIds, nextTabIds);

        await Promise.all(
            nextTabIds.map((tabId, index) =>
                tx.viewTab.update({
                    where: { id: tabId },
                    data: { order: index },
                }),
            ),
        );

        const reorderedTabs = await getOrderedViewTabs(tx);
        return reorderedTabs.map(serializeViewTab);
    });
};

export const createViewSection = async (tabId: string, input: ViewSectionInput) => {
    const numericTabId = parseViewId(tabId);
    const nextSection = normalizeViewSectionInput(input);

    return models.$transaction(async (tx) => {
        const tab = await tx.viewTab.findUnique({
            where: { id: numericTabId },
            select: { id: true },
        });

        if (!tab) {
            throw new Error('View tab not found.');
        }

        const nextSectionOrder = await getNextSectionOrder(tx, numericTabId);
        const query = await buildStoredViewQuery(tx, nextSection);

        const createdSection = await tx.viewSection.create({
            data: {
                tabId: numericTabId,
                title: nextSection.title,
                displayType: nextSection.displayType,
                query,
                mode: nextSection.mode,
                limit: nextSection.limit,
                order: nextSectionOrder,
                tags: {
                    create: nextSection.tagNames.map((tagName, index) => ({
                        name: tagName,
                        order: index,
                    })),
                },
            },
            include: orderedViewSectionTagsInclude,
        });

        return serializeViewSection(createdSection);
    });
};

export const updateViewSection = async (id: string, input: ViewSectionInput) => {
    const sectionId = parseViewId(id);
    const nextSection = normalizeViewSectionInput(input);

    return models.$transaction(async (tx) => {
        const query = await buildStoredViewQuery(tx, nextSection);

        const updatedSection = await tx.viewSection.update({
            where: { id: sectionId },
            data: {
                title: nextSection.title,
                displayType: nextSection.displayType,
                query,
                mode: nextSection.mode,
                limit: nextSection.limit,
                tags: {
                    deleteMany: {},
                    create: nextSection.tagNames.map((tagName, index) => ({
                        name: tagName,
                        order: index,
                    })),
                },
            },
            include: orderedViewSectionTagsInclude,
        });

        return serializeViewSection(updatedSection);
    });
};

export const deleteViewSection = async (id: string) => {
    const sectionId = parseViewId(id);

    return models.$transaction(async (tx) => {
        const section = await tx.viewSection.findUnique({
            where: { id: sectionId },
            select: { id: true, tabId: true },
        });

        if (!section) {
            return false;
        }

        await tx.viewSection.delete({
            where: { id: sectionId },
        });
        await resequenceViewSections(tx, section.tabId);

        return true;
    });
};

export const reorderViewSections = async (tabId: string, sectionIds: string[]) => {
    const numericTabId = parseViewId(tabId);
    const nextSectionIds = sectionIds.map(parseViewId);

    return models.$transaction(async (tx) => {
        const sections = await tx.viewSection.findMany({
            where: { tabId: numericTabId },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { id: true },
        });
        const currentSectionIds = sections.map((section) => section.id);

        ensureValidReorderIds(currentSectionIds, nextSectionIds);

        await Promise.all(
            nextSectionIds.map((sectionId, index) =>
                tx.viewSection.update({
                    where: { id: sectionId },
                    data: { order: index },
                }),
            ),
        );

        const reorderedSections = await tx.viewSection.findMany({
            where: { tabId: numericTabId },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            include: orderedViewSectionTagsInclude,
        });

        return reorderedSections.map(serializeViewSection);
    });
};
