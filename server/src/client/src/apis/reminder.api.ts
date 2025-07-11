import { graphQuery } from '~/modules/graph-query';

import type { Reminder, ReminderPriority } from '~/models/reminder.model';

export const createReminder = async (params: {
    noteId: string;
    reminderDate: Date;
    priority?: ReminderPriority;
    content?: string;
}) => {
    const { noteId, reminderDate, priority = 'medium', content } = params;

    return graphQuery<{ createReminder: Reminder }>(`
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
        reminderDate,
        priority,
        content
    });
};

export const updateReminder = async ({
    id,
    reminderDate,
    completed,
    priority,
    content
}: {
    id: string;
    reminderDate?: Date;
    completed?: boolean;
    priority?: ReminderPriority;
    content?: string;
}) => {
    const variables: Record<string, string | boolean | number> = { id };
    if (reminderDate) variables.reminderDate = reminderDate.toISOString();
    if (completed !== undefined) variables.completed = completed;
    if (priority) variables.priority = priority;
    if (content !== undefined) variables.content = content;

    return graphQuery<{ updateReminder: Reminder }>(`
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
    // Using GraphQL variables to properly handle the ID
    return graphQuery<{ deleteReminder: boolean }>(`
        mutation DeleteReminder($id: ID!) {
            deleteReminder(id: $id)
        }
    `, { id });
};
