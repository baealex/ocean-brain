import { graphQuery } from '~/modules/graph-query';

import type { Reminder, ReminderPriority, Reminders as ReminderCollection } from '~/models/reminder.model';
import type { Pagination } from '~/types';

export interface ReminderPaginationParams {
    limit?: number;
    offset?: number;
}

const toPaginationInput = (params: ReminderPaginationParams = {}): Pagination => {
    return {
        limit: params.limit ?? 10,
        offset: params.offset ?? 0
    };
};

export const fetchNoteReminders = async (noteId: string, pagination?: ReminderPaginationParams) => {
    return graphQuery<{ noteReminders: ReminderCollection }, { noteId: string; pagination: Pagination }>(`
        query FetchNoteReminders($noteId: ID!, $pagination: PaginationInput) {
            noteReminders(noteId: $noteId, pagination: $pagination) {
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
    `, {
        noteId,
        pagination: toPaginationInput(pagination)
    });
};

export const fetchUpcomingReminders = async (pagination?: ReminderPaginationParams) => {
    return graphQuery<{ upcomingReminders: ReminderCollection }, { pagination: Pagination }>(`
        query FetchUpcomingReminders($pagination: PaginationInput) {
            upcomingReminders(pagination: $pagination) {
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
    `, { pagination: toPaginationInput(pagination) });
};

export interface CreateReminderParams {
    noteId: string;
    reminderDate: Date;
    priority?: ReminderPriority;
    content?: string;
}

export const createReminder = async (params: CreateReminderParams) => {
    const { noteId, reminderDate, priority = 'medium', content } = params;

    return graphQuery<{ createReminder: Reminder }, {
        noteId: string;
        reminderDate: string;
        priority: ReminderPriority;
        content?: string;
    }>(`
        mutation CreateReminder($noteId: ID!, $reminderDate: String!, $priority: ReminderPriority, $content: String) {
            createReminder(
                noteId: $noteId,
                reminderDate: $reminderDate,
                priority: $priority,
                content: $content
            ) {
                id
                noteId
                reminderDate
                completed
                priority
                createdAt
                updatedAt
            }
        }
    `, {
        noteId,
        reminderDate: reminderDate.toISOString(),
        priority,
        content
    });
};

export interface UpdateReminderParams {
    id: string;
    reminderDate?: Date;
    completed?: boolean;
    priority?: ReminderPriority;
    content?: string;
}

interface UpdateReminderVariables {
    id: string;
    reminderDate?: string;
    completed?: boolean;
    priority?: ReminderPriority;
    content?: string;
}

export const updateReminder = async ({
    id,
    reminderDate,
    completed,
    priority,
    content
}: UpdateReminderParams) => {
    const variables: UpdateReminderVariables = { id };
    if (reminderDate) variables.reminderDate = reminderDate.toISOString();
    if (completed !== undefined) variables.completed = completed;
    if (priority) variables.priority = priority;
    if (content !== undefined) variables.content = content;

    return graphQuery<{ updateReminder: Reminder }, UpdateReminderVariables>(`
        mutation UpdateReminder(
            $id: ID!, 
            $reminderDate: String, 
            $completed: Boolean, 
            $priority: ReminderPriority,
            $content: String
        ) {
            updateReminder(
                id: $id,
                reminderDate: $reminderDate,
                completed: $completed,
                priority: $priority,
                content: $content
            ) {
                id
                noteId
                reminderDate
                completed
                priority
                createdAt
                updatedAt
            }
        }
    `, variables);
};

export const deleteReminder = async (id: string) => {
    return graphQuery<{ deleteReminder: boolean }, { id: string }>(`
        mutation DeleteReminder($id: ID!) {
            deleteReminder(id: $id)
        }
    `, { id });
};
