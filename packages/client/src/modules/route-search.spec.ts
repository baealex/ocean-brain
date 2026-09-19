// @vitest-environment node
import { afterEach, vi } from 'vitest';

import {
    validateCalendarSearch,
    validateGraphSearch,
    validateHomeSearch,
    validateIntegrationSearch,
    validateIntegrationsSearch,
    validatePaginationSearch,
    validateReminderSearch,
    validateSearchPageSearch,
    validateTagSearch,
    validateViewNotesSearch,
    validateViewsSearch,
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

    it('normalizes reminder management state', () => {
        expect(
            validateReminderSearch({
                page: '3',
                status: 'completed',
                scope: 'overdue',
                priority: 'high',
            }),
        ).toEqual({
            page: 3,
            status: 'completed',
            scope: 'all',
            priority: 'high',
        });

        expect(validateReminderSearch({ status: 'unknown', scope: 'later', priority: 'urgent' })).toEqual({
            page: 1,
            status: 'open',
            scope: 'all',
            priority: 'all',
        });
    });

    it('reads search page query and page', () => {
        expect(
            validateSearchPageSearch({
                page: '3',
                query: 'ocean',
                mode: 'semantic',
            }),
        ).toEqual({
            page: 3,
            query: 'ocean',
            mode: 'semantic',
        });

        expect(validateSearchPageSearch({ mode: 'unknown' }).mode).toBe('hybrid');
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

    it('normalizes graph selected note search values', () => {
        expect(validateGraphSearch({ selected: 'note-17' })).toEqual({ selected: 'note-17' });
        expect(validateGraphSearch({ selected: '  ' })).toEqual({});
        expect(validateGraphSearch({ selected: 17 })).toEqual({});
    });

    it('normalizes the expanded integration connection without retaining unrelated input', () => {
        expect(validateIntegrationsSearch({ connection: ' inbox ', unrelated: 'value' })).toEqual({
            connection: 'inbox',
        });
        expect(validateIntegrationsSearch({ connection: ['mcp', 'inbox'] })).toEqual({ connection: 'mcp' });
        expect(validateIntegrationsSearch({ connection: '  ' })).toEqual({});
        expect(validateIntegrationsSearch({ connection: { id: 'inbox' } })).toEqual({});
        expect(validateIntegrationsSearch({ connection: 17 })).toEqual({});
    });

    it('keeps only safe integration app locations', () => {
        expect(validateIntegrationSearch({ app: '/?query=whale&tag=ocean&page=2', unrelated: 'value' })).toEqual({
            app: '/?query=whale&tag=ocean&page=2',
        });
        expect(validateIntegrationSearch({ app: '/' })).toEqual({});
        expect(validateIntegrationSearch({ app: 'https://example.com/' })).toEqual({});
        expect(validateIntegrationSearch({ app: '/../settings' })).toEqual({});
        expect(validateIntegrationSearch({ app: '/%2e%2e/settings' })).toEqual({});
        expect(validateIntegrationSearch({ app: '/%252e%252e/settings' })).toEqual({});
        expect(validateIntegrationSearch({ app: ['/?page=2', '/?page=3'] })).toEqual({ app: '/?page=2' });
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

    it('normalizes versioned per-section view state', () => {
        expect(
            validateViewsSearch({
                tab: ' tab-1 ',
                state: {
                    version: 1,
                    sections: {
                        'section-1': { page: 2 },
                        'section-2': { columns: { todo: 3 } },
                    },
                },
            }),
        ).toEqual({
            tab: 'tab-1',
            state: {
                version: 1,
                sections: {
                    'section-1': { page: 2 },
                    'section-2': { columns: { todo: 3 } },
                },
            },
        });
    });
});
