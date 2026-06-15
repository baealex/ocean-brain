import type { Reminder, ReminderPriority } from '~/models/reminder.model';
import { localError, success } from '../response';
import type { LocalDemoPlugin } from '../types';
import { createLocalId, findNote, isInDateRange, now, paginate, toTimestampString } from '../utils';

export const remindersLocalPlugin: LocalDemoPlugin = {
    name: 'reminders',
    graphHandlers: {
        FetchUpcomingReminders: ({ state, variables }) => {
            const reminders = state.reminders
                .filter((reminder) => !reminder.completed)
                .map((reminder) => ({ ...reminder, note: findNote(state, reminder.noteId) }));
            return success({
                upcomingReminders: {
                    totalCount: reminders.length,
                    reminders: paginate(reminders, variables, { limit: 10, offset: 0 }),
                },
            });
        },
        FetchNoteReminders: ({ state, variables }) => {
            const reminders = state.reminders.filter(
                (reminder) => String(reminder.noteId) === String(variables.noteId),
            );
            return success({
                noteReminders: {
                    totalCount: reminders.length,
                    reminders: paginate(reminders, variables, { limit: 10, offset: 0 }),
                },
            });
        },
        CreateReminder: ({ state, variables, save }) => {
            const timestamp = now();
            const reminder: Reminder = {
                id: createLocalId('reminder'),
                noteId: variables.noteId as number,
                reminderDate: toTimestampString(variables.reminderDate),
                priority: (variables.priority as ReminderPriority | undefined) ?? 'medium',
                content: variables.content as string | undefined,
                completed: false,
                createdAt: timestamp,
                updatedAt: timestamp,
            };
            state.reminders.push(reminder);
            save();
            return success({ createReminder: reminder });
        },
        UpdateReminder: ({ state, variables, save }) => {
            const reminder = state.reminders.find((item) => item.id === String(variables.id));
            if (!reminder) return localError('Reminder not found');

            if (variables.reminderDate) reminder.reminderDate = toTimestampString(variables.reminderDate);
            if (typeof variables.completed === 'boolean') reminder.completed = variables.completed;
            if (variables.priority) reminder.priority = variables.priority as ReminderPriority;
            if (typeof variables.content === 'string') reminder.content = variables.content;
            reminder.updatedAt = now();
            save();
            return success({ updateReminder: reminder });
        },
        DeleteReminder: ({ state, variables, save }) => {
            state.reminders = state.reminders.filter((reminder) => reminder.id !== String(variables.id));
            save();
            return success({ deleteReminder: true });
        },
        RemindersInDateRange: ({ state, variables }) => {
            const dateRange = variables.dateRange as { start?: string; end?: string } | undefined;
            const reminders = state.reminders
                .filter((reminder) => isInDateRange(reminder.reminderDate, dateRange))
                .map((reminder) => ({ ...reminder, note: findNote(state, reminder.noteId) }));
            return success({ remindersInDateRange: reminders });
        },
    },
};
