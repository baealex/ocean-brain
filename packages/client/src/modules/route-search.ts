import dayjs from 'dayjs';

import type { SortBy, SortOrder } from '~/components/shared/NoteFilters';
import { HOME_DEFAULT_LIMIT, HOME_LIMIT_OPTIONS, type HomeLimit } from '~/modules/home-pagination';
import { TAG_DEFAULT_LIMIT, TAG_LIMIT_OPTIONS, type TagLimit } from '~/modules/tag-pagination';

type SearchRecord = Record<string, unknown>;

const HOME_SORT_BY = ['updatedAt', 'createdAt'] as const satisfies readonly SortBy[];
const TAG_SORT_BY = ['referenceCount', 'name'] as const;
const SORT_ORDER = ['asc', 'desc'] as const satisfies readonly SortOrder[];
const CALENDAR_TYPES = ['create', 'update'] as const;

const getFirstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value);

const parsePositiveInt = (
    value: unknown,
    fallback: number,
    { min = 1, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {},
) => {
    const normalized = getFirstValue(value);
    const parsed =
        typeof normalized === 'number' ? normalized : typeof normalized === 'string' ? Number(normalized) : Number.NaN;

    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        return fallback;
    }

    return parsed;
};

const parseNumberEnum = <TValue extends number>(
    value: unknown,
    allowedValues: readonly TValue[],
    fallback: TValue,
): TValue => {
    const parsed = parsePositiveInt(value, Number.NaN);

    return allowedValues.includes(parsed as TValue) ? (parsed as TValue) : fallback;
};

const parseBoolean = (value: unknown, fallback = false) => {
    const normalized = getFirstValue(value);

    if (normalized === true || normalized === 'true') {
        return true;
    }

    if (normalized === false || normalized === 'false') {
        return false;
    }

    return fallback;
};

const parseString = (value: unknown, fallback = '') => {
    const normalized = getFirstValue(value);
    return typeof normalized === 'string' ? normalized : fallback;
};

const parseEnum = <TValue extends string>(value: unknown, allowedValues: readonly TValue[], fallback: TValue) => {
    const normalized = getFirstValue(value);

    if (typeof normalized !== 'string') {
        return fallback;
    }

    return allowedValues.includes(normalized as TValue) ? (normalized as TValue) : fallback;
};

export interface HomeRouteSearch {
    page: number;
    limit: HomeLimit;
    sortBy: SortBy;
    sortOrder: SortOrder;
    pinnedFirst: boolean;
}

export interface PaginationRouteSearch {
    page: number;
}

export interface SearchRouteSearch extends PaginationRouteSearch {
    query: string;
}

export interface TagRouteSearch extends PaginationRouteSearch {
    query: string;
    limit: TagLimit;
    sortBy: (typeof TAG_SORT_BY)[number];
    sortOrder: SortOrder;
}

export interface CalendarRouteSearch {
    year: number;
    month: number;
    type: 'create' | 'update';
}

export interface ViewNotesRouteSearch extends PaginationRouteSearch {
    sectionId: string;
}

export const validateHomeSearch = (search: SearchRecord): HomeRouteSearch => ({
    page: parsePositiveInt(search.page, 1),
    limit: parseNumberEnum(search.limit, HOME_LIMIT_OPTIONS, HOME_DEFAULT_LIMIT),
    sortBy: parseEnum(search.sortBy, HOME_SORT_BY, 'updatedAt'),
    sortOrder: parseEnum(search.sortOrder, SORT_ORDER, 'desc'),
    pinnedFirst: parseBoolean(search.pinnedFirst, false),
});

export const validatePaginationSearch = (search: SearchRecord): PaginationRouteSearch => ({
    page: parsePositiveInt(search.page, 1),
});

export const validateSearchPageSearch = (search: SearchRecord): SearchRouteSearch => ({
    page: parsePositiveInt(search.page, 1),
    query: parseString(search.query, ''),
});

export const validateTagSearch = (search: SearchRecord): TagRouteSearch => ({
    page: parsePositiveInt(search.page, 1),
    query: parseString(search.query, ''),
    limit: parseNumberEnum(search.limit, TAG_LIMIT_OPTIONS, TAG_DEFAULT_LIMIT),
    sortBy: parseEnum(search.sortBy, TAG_SORT_BY, 'referenceCount'),
    sortOrder: parseEnum(search.sortOrder, SORT_ORDER, 'desc'),
});

export const validateCalendarSearch = (search: SearchRecord): CalendarRouteSearch => ({
    year: parsePositiveInt(search.year, dayjs().year(), {
        min: 1970,
        max: 9999,
    }),
    month: parsePositiveInt(search.month, dayjs().month() + 1, {
        min: 1,
        max: 12,
    }),
    type: parseEnum(search.type, CALENDAR_TYPES, 'create'),
});

export const validateViewNotesSearch = (search: SearchRecord): ViewNotesRouteSearch => ({
    page: parsePositiveInt(search.page, 1),
    sectionId: parseString(search.sectionId, ''),
});
