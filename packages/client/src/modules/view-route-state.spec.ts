// @vitest-environment node
import {
    buildLegacyViewNotesRouteState,
    getViewRouteState,
    normalizeViewRouteState,
    updateViewRouteState,
} from './view-route-state';

describe('view route state', () => {
    it('updates one view without replacing another view state', () => {
        const firstState = updateViewRouteState(undefined, 'view-1', { page: 2 });
        const nextState = updateViewRouteState(firstState, 'view-2', {
            page: 3,
            columns: { 'view-board-column:value:todo': 4 },
            calendar: { year: 2026, month: 8 },
            sort: { by: 'title', order: 'asc' },
        });

        expect(getViewRouteState(nextState, 'view-1')).toEqual({ page: 2 });
        expect(getViewRouteState(nextState, 'view-2')).toEqual({
            page: 3,
            columns: { 'view-board-column:value:todo': 4 },
            calendar: { year: 2026, month: 8 },
            sort: { by: 'title', order: 'asc' },
        });
    });

    it('removes default values and empty view state', () => {
        const state = updateViewRouteState(
            {
                version: 2,
                views: {
                    'view-1': { page: 2 },
                },
            },
            'view-1',
            { page: 1, columns: { todo: 1 } },
        );

        expect(state).toBeUndefined();
    });

    it('rejects malformed or unsupported URL state', () => {
        expect(normalizeViewRouteState({ version: 3, views: { view: { page: 3 } } })).toBeUndefined();
        expect(
            normalizeViewRouteState({
                version: 2,
                views: {
                    valid: {
                        page: 3,
                        columns: { todo: 2, capped: 100_000, invalid: -1 },
                        calendar: { year: 2026, month: 8 },
                        sort: { by: 'updatedAt', order: 'desc' },
                    },
                    invalid: { page: '4' },
                },
            }),
        ).toEqual({
            version: 2,
            views: {
                valid: {
                    page: 3,
                    columns: { todo: 2, capped: 50 },
                    sort: { by: 'updatedAt', order: 'desc' },
                    calendar: { year: 2026, month: 8 },
                },
            },
        });
    });

    it('drops invalid calendar month state without affecting valid view navigation', () => {
        expect(
            normalizeViewRouteState({
                version: 2,
                views: {
                    view: { page: 2, calendar: { year: 2026, month: 13 } },
                },
            }),
        ).toEqual({ version: 2, views: { view: { page: 2 } } });
    });

    it('preserves the legacy result offset when redirecting into view pagination', () => {
        expect(buildLegacyViewNotesRouteState('view-1', 2, 5)).toEqual({
            version: 2,
            views: {
                'view-1': { page: 6 },
            },
        });
        expect(buildLegacyViewNotesRouteState('view-1', 1, 5)).toBeUndefined();
    });
});

describe('legacy bookmarked views', () => {
    it('preserves pagination, sorting, board columns and calendar selection when upgrading a v1 link', () => {
        const selection = {
            page: 3,
            sort: { by: 'title', order: 'asc' },
            columns: { todo: 4 },
            calendar: { year: 2026, month: 9 },
        };
        expect(normalizeViewRouteState({ version: 1, sections: { '42': selection } })).toEqual({
            version: 2,
            views: { '42': selection },
        });
    });
});
