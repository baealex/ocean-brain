import { afterEach, vi } from 'vitest';

import {
    validateCalendarSearch,
    validateHomeSearch,
    validatePaginationSearch,
    validateSearchPageSearch,
    validateTagSearch,
    validateViewNotesSearch,
} from './route-search';

describe('route-search validators', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

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
            limit: 28,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
            pinnedFirst: true,
        });
    });

    it('keeps supported home page sizes and rejects unsupported limits', () => {
        expect(validateHomeSearch({ limit: '50' }).limit).toBe(50);
        expect(validateHomeSearch({ limit: '100' }).limit).toBe(100);
        expect(validateHomeSearch({ limit: '25' }).limit).toBe(28);
        expect(validateHomeSearch({ limit: '100000' }).limit).toBe(28);
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

    it('reads tag page query and page', () => {
        expect(
            validateTagSearch({
                page: '2',
                query: '@docs',
                limit: '200',
                sortBy: 'name',
                sortOrder: 'asc',
            }),
        ).toEqual({
            page: 2,
            query: '@docs',
            limit: 200,
            sortBy: 'name',
            sortOrder: 'asc',
        });
    });

    it('bounds calendar search values', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 3, 15));

        expect(
            validateCalendarSearch({
                year: '10000',
                month: '0',
                type: 'invalid',
            }),
        ).toEqual({
            year: 2026,
            month: 4,
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
