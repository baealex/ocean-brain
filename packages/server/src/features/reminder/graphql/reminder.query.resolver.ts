import type { IResolvers } from '@graphql-tools/utils';
import models from '~/models.js';
import type { Pagination } from '~/types/index.js';

interface ReminderListDeps {
    countReminders: (where: object) => Promise<number>;
    findReminders: (args: {
        where: object;
        orderBy: { reminderDate: 'asc' };
        take?: number;
        skip?: number;
        include?: { note: true };
    }) => Promise<unknown[]>;
}

type NoteRemindersResolverDeps = ReminderListDeps;
type UpcomingRemindersResolverDeps = ReminderListDeps;

export const createNoteRemindersQueryResolver = (
    deps: NoteRemindersResolverDeps = {
        countReminders: async (where) => models.reminder.count({ where }),
        findReminders: async (args) => models.reminder.findMany(args),
    },
) => {
    return async (
        _: unknown,
        {
            noteId,
            pagination = {
                limit: 10,
                offset: 0,
            },
        }: {
            noteId: string;
            pagination: Pagination;
        },
    ) => {
        const where = { noteId: Number(noteId) };
        const [totalCount, reminders] = await Promise.all([
            deps.countReminders(where),
            deps.findReminders({
                where,
                orderBy: { reminderDate: 'asc' },
                take: Number(pagination.limit),
                skip: Number(pagination.offset),
            }),
        ]);

        return {
            totalCount,
            reminders,
        };
    };
};

export const createUpcomingRemindersQueryResolver = (
    deps: UpcomingRemindersResolverDeps = {
        countReminders: async (where) => models.reminder.count({ where }),
        findReminders: async (args) => models.reminder.findMany(args),
    },
) => {
    return async (
        _: unknown,
        {
            pagination = {
                limit: 10,
                offset: 0,
            },
        }: {
            pagination: Pagination;
        },
    ) => {
        const where = { completed: false };
        const [totalCount, reminders] = await Promise.all([
            deps.countReminders(where),
            deps.findReminders({
                where,
                orderBy: { reminderDate: 'asc' },
                take: Number(pagination.limit),
                skip: Number(pagination.offset),
                include: { note: true },
            }),
        ]);

        return {
            totalCount,
            reminders,
        };
    };
};

type ReminderQueryResolvers = NonNullable<IResolvers['Query']>;

export const reminderQueryResolvers: ReminderQueryResolvers = {
    noteReminders: createNoteRemindersQueryResolver(),
    upcomingReminders: createUpcomingRemindersQueryResolver(),
    remindersInDateRange: async (
        _,
        {
            dateRange,
        }: {
            dateRange: {
                start: string;
                end: string;
            };
        },
    ) => {
        return models.reminder.findMany({
            where: {
                reminderDate: {
                    gte: new Date(dateRange.start),
                    lt: new Date(dateRange.end),
                },
            },
            orderBy: { reminderDate: 'asc' },
            include: { note: true },
        });
    },
};
