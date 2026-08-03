import type { Reminder, ReminderPriority } from '~/models/reminder.model';
import { localError, success } from '../response';
import type { LocalDemoPlugin, LocalDemoState, LocalGraphVariables } from '../types';
import { createLocalId, findNote, isInDateRange, now, paginate, toTimestampString } from '../utils';

type LocalReminderFilter = {
    status?: 'open' | 'completed';
    priority?: ReminderPriority;
    start?: string;
    end?: string;
    sortBy?: 'reminderDate' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
};

const toTime = (value: string | undefined) => {
    if (!value) return null;

    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) return numericValue;

    const parsedValue = Date.parse(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
};

const listReminders = (state: LocalDemoState, filter: LocalReminderFilter) => {
    const start = toTime(filter.start);
    const end = toTime(filter.end);
    const sortBy = filter.sortBy === 'updatedAt' ? 'updatedAt' : 'reminderDate';
    const direction = filter.sortOrder === 'desc' ? -1 : 1;

    return state.reminders
        .filter((reminder) => reminder.completed === (filter.status === 'completed'))
        .filter((reminder) => !filter.priority || reminder.priority === filter.priority)
        .filter((reminder) => {
            const reminderTime = toTime(reminder.reminderDate);
            if (reminderTime == null) return false;
            if (start != null && reminderTime < start) return false;
            if (end != null && reminderTime >= end) return false;
            return true;
        })
        .sort((left, right) => {
            const leftTime = toTime(left[sortBy]) ?? 0;
            const rightTime = toTime(right[sortBy]) ?? 0;
            if (leftTime !== rightTime) return (leftTime - rightTime) * direction;
            return left.id.localeCompare(right.id) * direction;
        })
        .map((reminder) => ({ ...reminder, note: findNote(state, reminder.noteId) }));
};

const reminderCollection = (state: LocalDemoState, variables: LocalGraphVariables, filter: LocalReminderFilter) => {
    const reminders = listReminders(state, filter);
    return {
        totalCount: reminders.length,
        reminders: paginate(reminders, variables, { limit: 25, offset: 0 }),
    };
};

export const remindersLocalPlugin: LocalDemoPlugin = {
    name: 'reminders',
    graphHandlers: {
        FetchReminders: ({ state, variables }) =>
            success({
                reminders: reminderCollection(state, variables, variables.filter as LocalReminderFilter),
            }),
        FetchOpenReminderOverview: ({ state, variables }) =>
            success({
                overdue: reminderCollection(state, variables, variables.overdueFilter as LocalReminderFilter),
                today: reminderCollection(state, variables, variables.todayFilter as LocalReminderFilter),
                upcoming: reminderCollection(state, variables, variables.upcomingFilter as LocalReminderFilter),
            }),
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
