import { useQuery } from '@tanstack/react-query';
import { fetchNotesInDateRange } from '~/apis/note.api';
import { fetchRemindersInDateRange } from '~/apis/reminder.api';
import { useWorkspaceScope } from '~/hooks/useWorkspaceScope';
import type { Note } from '~/models/note.model';
import type { Reminder } from '~/models/reminder.model';
import type { WorkspaceScope } from '~/models/workspace.model';
import { queryKeys } from '~/modules/query-key-factory';
import { getCalendarMonthRange } from './calendar-data';

interface DateRange {
    start: string;
    end: string;
}

const fetchNotesInRange = async (dateRange: DateRange, scope: WorkspaceScope): Promise<Note[]> => {
    const response = await fetchNotesInDateRange(dateRange, scope);
    if (response.type === 'error') {
        throw response;
    }
    return response.notesInDateRange;
};

const fetchRemindersInRange = async (dateRange: DateRange, scope: WorkspaceScope): Promise<Reminder[]> => {
    const response = await fetchRemindersInDateRange(dateRange, scope);
    if (response.type === 'error') {
        throw response;
    }
    return response.remindersInDateRange;
};

interface UseCalendarDataParams {
    year: number;
    month: number;
}

export const useCalendarData = ({ year, month }: UseCalendarDataParams) => {
    const scope = useWorkspaceScope();
    const dateRange = getCalendarMonthRange(year, month);

    const notesQuery = useQuery({
        queryKey: queryKeys.calendar.notesInDateRange(year, month, scope),
        queryFn: () => fetchNotesInRange(dateRange, scope),
    });

    const remindersQuery = useQuery({
        queryKey: queryKeys.reminders.inDateRange(year, month, scope),
        queryFn: () => fetchRemindersInRange(dateRange, scope),
    });

    return {
        notes: notesQuery.data ?? [],
        reminders: remindersQuery.data ?? [],
        isLoading: notesQuery.isLoading || remindersQuery.isLoading,
        isError: notesQuery.isError || remindersQuery.isError,
    };
};
