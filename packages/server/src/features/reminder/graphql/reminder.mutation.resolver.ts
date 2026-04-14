import type { IResolvers } from '@graphql-tools/utils';
import type { Reminder } from '~/models.js';
import models from '~/models.js';

type ReminderPriority = 'low' | 'medium' | 'high';

interface ReminderCreateInput {
    noteId: string;
    reminderDate: string;
    priority?: ReminderPriority;
    content?: string;
}

interface ReminderUpdateInput {
    id: string;
    reminderDate?: string;
    completed?: boolean;
    priority?: ReminderPriority;
    content?: string;
}

interface ReminderMutationDeps {
    createReminder: (data: {
        noteId: number;
        reminderDate: Date;
        completed: boolean;
        priority: ReminderPriority;
        content?: string;
    }) => Promise<unknown>;
    updateReminder: (id: number, data: Partial<Reminder>) => Promise<unknown>;
    deleteReminder: (id: number) => Promise<void>;
}

export const createCreateReminderMutationResolver = (
    deps: Pick<ReminderMutationDeps, 'createReminder'> = {
        createReminder: async (data) => models.reminder.create({ data }),
    },
) => {
    return async (_: unknown, input: ReminderCreateInput) => {
        return deps.createReminder({
            noteId: Number(input.noteId),
            reminderDate: new Date(input.reminderDate),
            completed: false,
            priority: input.priority || 'medium',
            content: input.content,
        });
    };
};

export const createUpdateReminderMutationResolver = (
    deps: Pick<ReminderMutationDeps, 'updateReminder'> = {
        updateReminder: async (id, data) =>
            models.reminder.update({
                where: { id },
                data,
            }),
    },
) => {
    return async (_: unknown, input: ReminderUpdateInput) => {
        const data: Partial<Reminder> = {};

        if (input.reminderDate) {
            data.reminderDate = new Date(input.reminderDate);
        }

        if (input.completed !== undefined) {
            data.completed = input.completed;
        }

        if (input.priority) {
            data.priority = input.priority;
        }

        if (input.content !== undefined) {
            data.content = input.content;
        }

        return deps.updateReminder(Number(input.id), data);
    };
};

export const createDeleteReminderMutationResolver = (
    deps: Pick<ReminderMutationDeps, 'deleteReminder'> = {
        deleteReminder: async (id) => {
            await models.reminder.delete({ where: { id } });
        },
    },
) => {
    return async (_: unknown, { id }: { id: string }) => {
        await deps.deleteReminder(Number(id));
        return true;
    };
};

type ReminderMutationResolvers = NonNullable<IResolvers['Mutation']>;

export const reminderMutationResolvers: ReminderMutationResolvers = {
    createReminder: createCreateReminderMutationResolver(),
    updateReminder: createUpdateReminderMutationResolver(),
    deleteReminder: createDeleteReminderMutationResolver(),
};
