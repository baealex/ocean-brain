import { useQuery } from '@tanstack/react-query';

import type { Note } from '~/models/note.model';
import type { Reminder } from '~/models/reminder.model';
import { graphQuery } from '~/modules/graph-query';

const NOTES_QUERY = `
    query NotesInDateRange($dateRange: DateRangeInput) {
        notesInDateRange(dateRange: $dateRange) {
            id
            title
            createdAt
            updatedAt
        }
    }
`;

const REMINDERS_QUERY = `
    query RemindersInDateRange($dateRange: DateRangeInput) {
        remindersInDateRange(dateRange: $dateRange) {
            id
            noteId
            reminderDate
            completed
            priority
            content
            note {
                id
                title
            }
        }
    }
`;

interface DateRange {
    start: string;
    end: string;
}

const fetchNotesInRange = async (dateRange: DateRange): Promise<Note[]> => {
    const response = await graphQuery<{ notesInDateRange: Note[] }>(
        NOTES_QUERY,
        { dateRange }
    );
    if (response.type === 'error') {
        throw response;
    }
    return response.notesInDateRange;
};

const fetchRemindersInRange = async (dateRange: DateRange): Promise<Reminder[]> => {
    const response = await graphQuery<{ remindersInDateRange: Reminder[] }>(
        REMINDERS_QUERY,
        { dateRange }
    );
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
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const dateRange = {
        start: startDate,
        end: endDate
    };

    const notesQuery = useQuery({
        queryKey: ['notesInDateRange', year, month],
        queryFn: () => fetchNotesInRange(dateRange)
    });

    const remindersQuery = useQuery({
        queryKey: ['remindersInDateRange', year, month],
        queryFn: () => fetchRemindersInRange(dateRange)
    });

    return {
        notes: notesQuery.data ?? [],
        reminders: remindersQuery.data ?? [],
        isLoading: notesQuery.isLoading || remindersQuery.isLoading,
        isError: notesQuery.isError || remindersQuery.isError
    };
};
