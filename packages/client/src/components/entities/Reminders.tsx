import { useSuspenseQuery } from '@tanstack/react-query';
import { fetchNoteReminders, fetchUpcomingReminders } from '~/apis/reminder.api';

import type { Reminders as RemindersType } from '~/models/reminder.model';
import type { Pagination } from '~/types';
import { queryKeys } from '~/modules/query-key-factory';

interface RemindersProps {
    noteId?: string;
    searchParams?: Pagination;
    render: (data: RemindersType) => React.ReactNode;
}

export default function Reminders({ noteId, searchParams, render }: RemindersProps) {
    const { data } = useSuspenseQuery({
        queryKey: noteId
            ? queryKeys.reminders.note(noteId, searchParams)
            : queryKeys.reminders.upcoming(searchParams),
        queryFn: async () => {
            if (noteId) {
                const noteRemindersResponse = await fetchNoteReminders(noteId, searchParams);
                if (noteRemindersResponse.type === 'error') {
                    throw noteRemindersResponse;
                }
                return noteRemindersResponse.noteReminders;
            }

            const upcomingRemindersResponse = await fetchUpcomingReminders(searchParams);
            if (upcomingRemindersResponse.type === 'error') {
                throw upcomingRemindersResponse;
            }
            return upcomingRemindersResponse.upcomingReminders;
        }
    });

    return <>{render(data)}</>;
}
