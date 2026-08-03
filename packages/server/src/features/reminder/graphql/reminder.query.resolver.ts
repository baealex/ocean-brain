import type { IResolvers } from '@graphql-tools/utils';
import type { Prisma } from '~/models.js';
import models from '~/models.js';
import type { Pagination } from '~/types/index.js';

interface ReminderListDeps {
    countReminders: (where: Prisma.ReminderWhereInput) => Promise<number>;
    findReminders: (args: {
        where: Prisma.ReminderWhereInput;
        orderBy: Prisma.ReminderOrderByWithRelationInput | Prisma.ReminderOrderByWithRelationInput[];
        take?: number;
        skip?: number;
        include?: { note: true };
    }) => Promise<unknown[]>;
}

type NoteRemindersResolverDeps = ReminderListDeps;
type UpcomingRemindersResolverDeps = ReminderListDeps;
type RemindersResolverDeps = ReminderListDeps;

type ReminderFilter = {
    status?: 'open' | 'completed';
    priority?: 'low' | 'medium' | 'high';
    start?: string;
    end?: string;
    sortBy?: 'reminderDate' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
};

const DEFAULT_REMINDER_LIMIT = 25;
const MAX_REMINDER_LIMIT = 100;

const toValidDate = (value?: string) => {
    if (!value) return undefined;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error('Reminder date filters must be valid date strings.');
    }

    return date;
};

const normalizeReminderPagination = (pagination?: Pagination | null) => {
    const numericLimit = Number(pagination?.limit ?? DEFAULT_REMINDER_LIMIT);
    const limit = Number.isInteger(numericLimit)
        ? Math.min(MAX_REMINDER_LIMIT, Math.max(1, numericLimit))
        : DEFAULT_REMINDER_LIMIT;
    const numericOffset = Number(pagination?.offset ?? 0);
    const offset = Number.isInteger(numericOffset) ? Math.max(0, numericOffset) : 0;

    return { limit, offset };
};

const buildReminderWhere = (filter: ReminderFilter): Prisma.ReminderWhereInput => {
    const start = toValidDate(filter.start);
    const end = toValidDate(filter.end);
    const reminderDate: Prisma.DateTimeFilter = {};

    if (start) reminderDate.gte = start;
    if (end) reminderDate.lt = end;

    return {
        completed: filter.status === 'completed',
        ...(filter.priority ? { priority: filter.priority } : {}),
        ...(start || end ? { reminderDate } : {}),
    };
};

const buildReminderOrderBy = (filter: ReminderFilter): Prisma.ReminderOrderByWithRelationInput[] => {
    const sortBy = filter.sortBy === 'updatedAt' ? 'updatedAt' : 'reminderDate';
    const sortOrder = filter.sortOrder === 'desc' ? 'desc' : 'asc';

    return [{ [sortBy]: sortOrder }, { id: sortOrder }];
};

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

export const createRemindersQueryResolver = (
    deps: RemindersResolverDeps = {
        countReminders: async (where) => models.reminder.count({ where }),
        findReminders: async (args) => models.reminder.findMany(args),
    },
) => {
    return async (
        _: unknown,
        {
            filter,
            pagination,
        }: {
            filter: ReminderFilter;
            pagination?: Pagination | null;
        },
    ) => {
        const where = buildReminderWhere(filter);
        const normalizedPagination = normalizeReminderPagination(pagination);
        const [totalCount, reminders] = await Promise.all([
            deps.countReminders(where),
            deps.findReminders({
                where,
                orderBy: buildReminderOrderBy(filter),
                take: normalizedPagination.limit,
                skip: normalizedPagination.offset,
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
    reminders: createRemindersQueryResolver(),
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
