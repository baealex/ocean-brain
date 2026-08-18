// @vitest-environment node
import {
    buildLegacyViewNotesRouteState,
    getViewSectionRouteState,
    normalizeViewRouteState,
    updateViewSectionRouteState,
} from './view-route-state';

describe('view route state', () => {
    it('updates one section without replacing another section state', () => {
        const firstState = updateViewSectionRouteState(undefined, 'section-1', { page: 2 });
        const nextState = updateViewSectionRouteState(firstState, 'section-2', {
            page: 3,
            columns: { 'view-board-column:value:todo': 4 },
            calendar: { year: 2026, month: 8 },
            sort: { by: 'title', order: 'asc' },
        });

        expect(getViewSectionRouteState(nextState, 'section-1')).toEqual({ page: 2 });
        expect(getViewSectionRouteState(nextState, 'section-2')).toEqual({
            page: 3,
            columns: { 'view-board-column:value:todo': 4 },
            calendar: { year: 2026, month: 8 },
            sort: { by: 'title', order: 'asc' },
        });
    });

    it('removes default values and empty section state', () => {
        const state = updateViewSectionRouteState(
            {
                version: 1,
                sections: {
                    'section-1': { page: 2 },
                },
            },
            'section-1',
            { page: 1, columns: { todo: 1 } },
        );

        expect(state).toBeUndefined();
    });

    it('rejects malformed or unsupported URL state', () => {
        expect(normalizeViewRouteState({ version: 2, sections: { section: { page: 3 } } })).toBeUndefined();
        expect(
            normalizeViewRouteState({
                version: 1,
                sections: {
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
            version: 1,
            sections: {
                valid: {
                    page: 3,
                    columns: { todo: 2, capped: 50 },
                    sort: { by: 'updatedAt', order: 'desc' },
                    calendar: { year: 2026, month: 8 },
                },
            },
        });
    });

    it('drops invalid calendar month state without affecting valid section navigation', () => {
        expect(
            normalizeViewRouteState({
                version: 1,
                sections: {
                    section: { page: 2, calendar: { year: 2026, month: 13 } },
                },
            }),
        ).toEqual({ version: 1, sections: { section: { page: 2 } } });
    });

    it('preserves the legacy result offset when redirecting into section pagination', () => {
        expect(buildLegacyViewNotesRouteState('section-1', 2, 5)).toEqual({
            version: 1,
            sections: {
                'section-1': { page: 6 },
            },
        });
        expect(buildLegacyViewNotesRouteState('section-1', 1, 5)).toBeUndefined();
    });
});
