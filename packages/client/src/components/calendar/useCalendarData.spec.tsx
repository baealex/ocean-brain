import { renderHook, waitFor } from '@testing-library/react';

import { graphQuery } from '~/modules/graph-query';
import { createQueryClientWrapper } from '~/test/test-utils';

import { useCalendarData } from './useCalendarData';

vi.mock('~/modules/graph-query', () => ({ graphQuery: vi.fn() }));

describe('useCalendarData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads notes and reminders with a date range that crosses the year boundary', async () => {
        vi.mocked(graphQuery).mockImplementation(async (query) => {
            if (String(query).includes('NotesInDateRange')) {
                return {
                    type: 'success',
                    notesInDateRange: [{ id: 'note-1', title: 'Year-end note' }],
                } as never;
            }

            return {
                type: 'success',
                remindersInDateRange: [{ id: 'reminder-1', content: 'Year-end reminder' }],
            } as never;
        });
        const { Wrapper } = createQueryClientWrapper();
        const expectedDateRange = {
            start: new Date(2026, 11, 1).toISOString(),
            end: new Date(2027, 0, 1).toISOString(),
        };

        const { result } = renderHook(() => useCalendarData({ year: 2026, month: 12 }), { wrapper: Wrapper });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });
        expect(graphQuery).toHaveBeenCalledTimes(2);
        expect(graphQuery).toHaveBeenCalledWith(expect.stringContaining('query NotesInDateRange'), {
            dateRange: expectedDateRange,
        });
        expect(graphQuery).toHaveBeenCalledWith(expect.stringContaining('query RemindersInDateRange'), {
            dateRange: expectedDateRange,
        });
        expect(result.current.notes).toEqual([{ id: 'note-1', title: 'Year-end note' }]);
        expect(result.current.reminders).toEqual([{ id: 'reminder-1', content: 'Year-end reminder' }]);
    });
});
