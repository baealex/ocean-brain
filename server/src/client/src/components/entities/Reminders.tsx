import { useQuery } from '@tanstack/react-query';
import { graphQuery } from '~/modules/graph-query';

import type { Reminders as RemindersType } from '~/models/reminder.model';
import type { Pagination } from '~/types';

interface RemindersProps {
    noteId?: string;
    searchParams?: Pagination;
    render: (data: RemindersType) => React.ReactNode;
}

export default function Reminders({ noteId, searchParams, render }: RemindersProps) {
    const { data } = useQuery({
        queryKey: noteId ? ['noteReminders', noteId, searchParams] : ['upcomingReminders', searchParams],
        queryFn: async () => {
            const pagination = searchParams ? `pagination: { limit: ${searchParams.limit}, offset: ${searchParams.offset} }` : '';

            let query;
            if (noteId) {
                query = `
                    query {
                        noteReminders(noteId: "${noteId}", ${pagination}) {
                            totalCount
                            reminders {
                                id
                                noteId
                                reminderDate
                                priority
                                content
                                completed
                                createdAt
                                updatedAt
                            }
                        }
                    }
                `;
            } else {
                query = `
                    query {
                        upcomingReminders(${pagination}) {
                            totalCount
                            reminders {
                                id
                                noteId
                                reminderDate
                                priority
                                content
                                completed
                                createdAt
                                updatedAt
                                note {
                                    id
                                    title
                                }
                            }
                        }
                    }
                `;
            }

            const response = await graphQuery<{
                noteReminders?: RemindersType;
                upcomingReminders?: RemindersType;
            }>(query);

            if (response.type === 'error') {
                throw response;
            }

            return noteId ? response.noteReminders : response.upcomingReminders;
        }
    });

    if (!data) {
        return null;
    }

    return <>{render(data)}</>;
}
