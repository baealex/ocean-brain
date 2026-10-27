import type { ViewSortBy, ViewSortOrder } from '~/models/view.model';

export const VIEW_ROUTE_STATE_VERSION = 2 as const;

const MAX_VIEW_STATES = 100;
const MAX_COLUMN_STATES = 100;
const MAX_STATE_KEY_LENGTH = 256;
const MAX_PAGE = 100_000;
const MAX_BOARD_COLUMN_PAGES = 50;
const MIN_CALENDAR_YEAR = 1970;
const MAX_CALENDAR_YEAR = 9999;
const LEGACY_VIEW_NOTES_PAGE_SIZE = 25;

export interface ViewNavigationState {
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
    views: Record<string, ViewNavigationState>;
}

export type ViewRouteStateUpdater = ViewNavigationState | ((current: ViewNavigationState) => ViewNavigationState);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isValidStateKey = (value: string) => value.length > 0 && value.length <= MAX_STATE_KEY_LENGTH;

const normalizePage = (value: unknown) =>
    typeof value === 'number' && Number.isInteger(value) && value > 1 && value <= MAX_PAGE ? value : undefined;

const normalizeBoardColumnPage = (value: unknown) =>
    typeof value === 'number' && Number.isInteger(value) && value > 1
        ? Math.min(value, MAX_BOARD_COLUMN_PAGES)
        : undefined;

const normalizeSort = (value: unknown): ViewNavigationState['sort'] => {
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

const normalizeCalendar = (value: unknown): ViewNavigationState['calendar'] => {
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

const normalizeViewState = (value: unknown): ViewNavigationState | undefined => {
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
    if (!isRecord(value)) {
        return undefined;
    }

    const savedViews =
        value.version === 1 ? value.sections : value.version === VIEW_ROUTE_STATE_VERSION ? value.views : undefined;
    if (!isRecord(savedViews)) return undefined;

    const views = Object.fromEntries(
        Object.entries(savedViews)
            .filter(([viewId]) => isValidStateKey(viewId))
            .slice(0, MAX_VIEW_STATES)
            .flatMap(([viewId, viewState]) => {
                const normalizedState = normalizeViewState(viewState);
                return normalizedState === undefined ? [] : [[viewId, normalizedState]];
            }),
    );

    return Object.keys(views).length === 0
        ? undefined
        : {
              version: VIEW_ROUTE_STATE_VERSION,
              views,
          };
};

export const getViewRouteState = (state: ViewRouteState | undefined, viewId: string): ViewNavigationState =>
    state?.views[viewId] ?? {};

export const updateViewRouteState = (
    state: ViewRouteState | undefined,
    viewId: string,
    updater: ViewRouteStateUpdater,
): ViewRouteState | undefined => {
    if (!isValidStateKey(viewId)) {
        return normalizeViewRouteState(state);
    }

    const normalizedState = normalizeViewRouteState(state);
    const currentViewState = getViewRouteState(normalizedState, viewId);
    const nextViewState = normalizeViewState(typeof updater === 'function' ? updater(currentViewState) : updater);
    const nextViews = Object.fromEntries(
        Object.entries({
            ...(normalizedState?.views ?? {}),
            [viewId]: nextViewState,
        }).filter((entry): entry is [string, ViewNavigationState] => entry[1] !== undefined),
    );

    return Object.keys(nextViews).length === 0
        ? undefined
        : {
              version: VIEW_ROUTE_STATE_VERSION,
              views: nextViews,
          };
};

export const buildLegacyViewNotesRouteState = (
    viewId: string,
    legacyPage: number,
    viewPageSize: number,
): ViewRouteState | undefined => {
    if (!Number.isSafeInteger(legacyPage) || legacyPage <= 1) {
        return undefined;
    }

    const normalizedPageSize =
        Number.isSafeInteger(viewPageSize) && viewPageSize > 0 ? viewPageSize : LEGACY_VIEW_NOTES_PAGE_SIZE;
    const legacyOffset = Math.min(Number.MAX_SAFE_INTEGER, (legacyPage - 1) * LEGACY_VIEW_NOTES_PAGE_SIZE);
    const viewPage = Math.min(MAX_PAGE, Math.floor(legacyOffset / normalizedPageSize) + 1);

    return updateViewRouteState(undefined, viewId, { page: viewPage });
};
