import type { ViewSortBy, ViewSortOrder } from '~/models/view.model';

export const VIEW_ROUTE_STATE_VERSION = 1 as const;

const MAX_SECTION_STATES = 100;
const MAX_COLUMN_STATES = 100;
const MAX_STATE_KEY_LENGTH = 256;
const MAX_PAGE = 100_000;
const MAX_BOARD_COLUMN_PAGES = 50;
const MIN_CALENDAR_YEAR = 1970;
const MAX_CALENDAR_YEAR = 9999;
const LEGACY_VIEW_NOTES_PAGE_SIZE = 25;

export interface ViewSectionRouteState {
    page?: number;
    columns?: Record<string, number>;
    calendar?: {
        year: number;
        month: number;
    };
    sort?: {
        by: ViewSortBy;
        order: ViewSortOrder;
    };
}

export interface ViewRouteState {
    version: typeof VIEW_ROUTE_STATE_VERSION;
    sections: Record<string, ViewSectionRouteState>;
}

export type ViewSectionRouteStateUpdater =
    | ViewSectionRouteState
    | ((current: ViewSectionRouteState) => ViewSectionRouteState);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isValidStateKey = (value: string) => value.length > 0 && value.length <= MAX_STATE_KEY_LENGTH;

const normalizePage = (value: unknown) =>
    typeof value === 'number' && Number.isInteger(value) && value > 1 && value <= MAX_PAGE ? value : undefined;

const normalizeBoardColumnPage = (value: unknown) =>
    typeof value === 'number' && Number.isInteger(value) && value > 1
        ? Math.min(value, MAX_BOARD_COLUMN_PAGES)
        : undefined;

const normalizeSort = (value: unknown): ViewSectionRouteState['sort'] => {
    if (!isRecord(value)) {
        return undefined;
    }

    const by = value.by;
    const order = value.order;

    if ((by !== 'title' && by !== 'createdAt' && by !== 'updatedAt') || (order !== 'asc' && order !== 'desc')) {
        return undefined;
    }

    return { by, order };
};

const normalizeCalendar = (value: unknown): ViewSectionRouteState['calendar'] => {
    if (!isRecord(value)) {
        return undefined;
    }

    const year = value.year;
    const month = value.month;

    if (
        typeof year !== 'number' ||
        !Number.isInteger(year) ||
        year < MIN_CALENDAR_YEAR ||
        year > MAX_CALENDAR_YEAR ||
        typeof month !== 'number' ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
    ) {
        return undefined;
    }

    return { year, month };
};

const normalizeSectionState = (value: unknown): ViewSectionRouteState | undefined => {
    if (!isRecord(value)) {
        return undefined;
    }

    const page = normalizePage(value.page);
    const sort = normalizeSort(value.sort);
    const calendar = normalizeCalendar(value.calendar);
    const columns = isRecord(value.columns)
        ? Object.fromEntries(
              Object.entries(value.columns)
                  .filter(([key]) => isValidStateKey(key))
                  .slice(0, MAX_COLUMN_STATES)
                  .flatMap(([key, columnPage]) => {
                      const normalizedPage = normalizeBoardColumnPage(columnPage);
                      return normalizedPage === undefined ? [] : [[key, normalizedPage]];
                  }),
          )
        : {};

    if (page === undefined && Object.keys(columns).length === 0 && sort === undefined && calendar === undefined) {
        return undefined;
    }

    return {
        ...(page === undefined ? {} : { page }),
        ...(Object.keys(columns).length === 0 ? {} : { columns }),
        ...(sort === undefined ? {} : { sort }),
        ...(calendar === undefined ? {} : { calendar }),
    };
};

export const normalizeViewRouteState = (value: unknown): ViewRouteState | undefined => {
    if (!isRecord(value) || value.version !== VIEW_ROUTE_STATE_VERSION || !isRecord(value.sections)) {
        return undefined;
    }

    const sections = Object.fromEntries(
        Object.entries(value.sections)
            .filter(([sectionId]) => isValidStateKey(sectionId))
            .slice(0, MAX_SECTION_STATES)
            .flatMap(([sectionId, sectionState]) => {
                const normalizedState = normalizeSectionState(sectionState);
                return normalizedState === undefined ? [] : [[sectionId, normalizedState]];
            }),
    );

    return Object.keys(sections).length === 0
        ? undefined
        : {
              version: VIEW_ROUTE_STATE_VERSION,
              sections,
          };
};

export const getViewSectionRouteState = (state: ViewRouteState | undefined, sectionId: string): ViewSectionRouteState =>
    state?.sections[sectionId] ?? {};

export const updateViewSectionRouteState = (
    state: ViewRouteState | undefined,
    sectionId: string,
    updater: ViewSectionRouteStateUpdater,
): ViewRouteState | undefined => {
    if (!isValidStateKey(sectionId)) {
        return normalizeViewRouteState(state);
    }

    const normalizedState = normalizeViewRouteState(state);
    const currentSectionState = getViewSectionRouteState(normalizedState, sectionId);
    const nextSectionState = normalizeSectionState(
        typeof updater === 'function' ? updater(currentSectionState) : updater,
    );
    const nextSections = Object.fromEntries(
        Object.entries({
            ...(normalizedState?.sections ?? {}),
            [sectionId]: nextSectionState,
        }).filter((entry): entry is [string, ViewSectionRouteState] => entry[1] !== undefined),
    );

    return Object.keys(nextSections).length === 0
        ? undefined
        : {
              version: VIEW_ROUTE_STATE_VERSION,
              sections: nextSections,
          };
};

export const buildLegacyViewNotesRouteState = (
    sectionId: string,
    legacyPage: number,
    sectionPageSize: number,
): ViewRouteState | undefined => {
    if (!Number.isSafeInteger(legacyPage) || legacyPage <= 1) {
        return undefined;
    }

    const normalizedPageSize =
        Number.isSafeInteger(sectionPageSize) && sectionPageSize > 0 ? sectionPageSize : LEGACY_VIEW_NOTES_PAGE_SIZE;
    const legacyOffset = Math.min(Number.MAX_SAFE_INTEGER, (legacyPage - 1) * LEGACY_VIEW_NOTES_PAGE_SIZE);
    const sectionPage = Math.min(MAX_PAGE, Math.floor(legacyOffset / normalizedPageSize) + 1);

    return updateViewSectionRouteState(undefined, sectionId, { page: sectionPage });
};
