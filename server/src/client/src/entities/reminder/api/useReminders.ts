import { useQuery } from '@tanstack/react-query';
import { graphQuery } from '~/modules/graph-query';
import type { Reminders } from '../model/reminder.model';
import type { Pagination } from '~/types';

interface UseRemindersParams {
    noteId?: string;
    searchParams?: Pagination;
}

export const useReminders = ({ noteId, searchParams }: UseRemindersParams = {}) => {
    return useQuery({
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
                noteReminders?: Reminders;
                upcomingReminders?: Reminders;
            }>(query);

            if (response.type === 'error') {
                throw response;
            }

            return noteId ? response.noteReminders : response.upcomingReminders;
        }
    });
};
