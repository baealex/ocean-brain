import { graphQuery } from '~/modules/graph-query';

import type { Reminder } from '~/models/reminder.model';

export const createReminder = async ({
    noteId,
    reminderDate
}: {
    noteId: string;
    reminderDate: Date;
}) => {
    return graphQuery<{ createReminder: Reminder }>(`
        mutation {
            createReminder(
                noteId: "${noteId}",
                reminderDate: "${reminderDate.toISOString()}"
            ) {
                id
                noteId
                reminderDate
                completed
                createdAt
                updatedAt
            }
        }
    `);
};

export const updateReminder = async ({
    id,
    reminderDate,
    completed
}: {
    id: string;
    reminderDate?: Date;
    completed?: boolean;
}) => {
    const reminderDateParam = reminderDate ? `reminderDate: "${reminderDate.toISOString()}"` : '';
    const completedParam = completed !== undefined ? `completed: ${completed}` : '';
    const params = [reminderDateParam, completedParam].filter(Boolean).join(', ');

    return graphQuery<{ updateReminder: Reminder }>(`
        mutation {
            updateReminder(
                id: "${id}",
                ${params}
            ) {
                id
                noteId
                reminderDate
                completed
                createdAt
                updatedAt
            }
        }
    `);
};

export const deleteReminder = async (id: string) => {
    return graphQuery<{ deleteReminder: boolean }>(`
        mutation {
            deleteReminder(id: "${id}")
        }
    `);
};
