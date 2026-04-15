import type { IResolvers } from '@graphql-tools/utils';
import models from '~/models.js';

type ReminderFieldResolvers = NonNullable<IResolvers['Reminder']>;

export const reminderFieldResolvers: ReminderFieldResolvers = {
    note: async (reminder: { noteId: number }) => {
        return models.note.findUnique({ where: { id: reminder.noteId } });
    },
};
