import dayjs from 'dayjs';

import {
    validateCalendarSearch,
    validateHomeSearch,
    validatePaginationSearch,
    validateSearchPageSearch,
    validateViewNotesSearch,
} from './route-search';

describe('route-search validators', () => {
    it('normalizes invalid home search input', () => {
        expect(
            validateHomeSearch({
                page: '0',
                limit: 'foo',
                sortBy: 'invalid',
                sortOrder: 'up',
                pinnedFirst: 'true',
            }),
        ).toEqual({
            page: 1,
            limit: undefined,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
            pinnedFirst: true,
        });
    });

    it('returns a safe pagination fallback', () => {
        expect(validatePaginationSearch({ page: '-2' })).toEqual({ page: 1 });
    });

    it('reads search page query and page', () => {
        expect(
            validateSearchPageSearch({
                page: '3',
                query: 'ocean',
            }),
        ).toEqual({
            page: 3,
            query: 'ocean',
        });
    });

    it('bounds calendar search values', () => {
        expect(
            validateCalendarSearch({
                year: '10000',
                month: '0',
                type: 'invalid',
            }),
        ).toEqual({
            year: dayjs().year(),
            month: dayjs().month() + 1,
            type: 'create',
        });
    });

    it('normalizes view-notes search values', () => {
        expect(
            validateViewNotesSearch({
                page: '0',
                sectionId: '17',
            }),
        ).toEqual({
            page: 1,
            sectionId: '17',
        });
    });
});
