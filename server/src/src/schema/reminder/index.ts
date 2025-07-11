import type { IResolvers } from '@graphql-tools/utils';

import type { Reminder } from '~/models';
import models from '~/models';
import { gql } from '~/modules/graphql';

import type { Pagination } from '~/types';

export const reminderType = gql`
    enum ReminderPriority {
        low
        medium
        high
    }

    type Reminder {
        id: ID!
        noteId: Int!
        reminderDate: String!
        completed: Boolean!
        priority: ReminderPriority
        content: String
        createdAt: String!
        updatedAt: String!
        note: Note
    }

    type Reminders {
        totalCount: Int!
        reminders: [Reminder!]!
    }
`;

export const reminderQuery = gql`
    extend type Query {
        noteReminders(noteId: ID!, pagination: PaginationInput): Reminders!
        upcomingReminders(pagination: PaginationInput): Reminders!
    }
`;

export const reminderMutation = gql`
    extend type Mutation {
        createReminder(noteId: ID!, reminderDate: String!, priority: ReminderPriority, content: String): Reminder!
        updateReminder(id: ID!, reminderDate: String, completed: Boolean, priority: ReminderPriority, content: String): Reminder!
        deleteReminder(id: ID!): Boolean!
    }
`;

export const reminderTypeDefs = `
    ${reminderType}
    ${reminderQuery}
    ${reminderMutation}
`;

export const reminderResolvers: IResolvers = {
    Query: {
        noteReminders: async (_, {
            noteId,
            pagination = {
                limit: 10,
                offset: 0
            }
        }: {
            noteId: string;
            pagination: Pagination;
        }) => {
            const where = { noteId: Number(noteId) };

            const $reminders = models.reminder.findMany({
                where,
                orderBy: { reminderDate: 'asc' },
                take: Number(pagination.limit),
                skip: Number(pagination.offset)
            });

            return {
                totalCount: models.reminder.count({ where }),
                reminders: $reminders
            };
        },
        upcomingReminders: async (_, {
            pagination = {
                limit: 10,
                offset: 0
            }
        }: {
            pagination: Pagination;
        }) => {
            const where = {
                completed: false,
                reminderDate: { gte: new Date() }
            };

            const $reminders = models.reminder.findMany({
                where,
                orderBy: { reminderDate: 'asc' },
                take: Number(pagination.limit),
                skip: Number(pagination.offset),
                include: { note: true }
            });

            return {
                totalCount: models.reminder.count({ where }),
                reminders: $reminders
            };
        }
    },
    Mutation: {
        createReminder: async (_, {
            noteId,
            reminderDate,
            priority,
            content
        }: {
            noteId: string;
            reminderDate: string;
            priority?: 'low' | 'medium' | 'high';
            content?: string;
        }) => {
            return models.reminder.create({
                data: {
                    noteId: Number(noteId),
                    reminderDate: new Date(reminderDate),
                    completed: false,
                    priority: priority || 'medium',
                    content
                }
            });
        },
        updateReminder: async (_, {
            id,
            reminderDate,
            completed,
            priority,
            content
        }: {
            id: string;
            reminderDate?: string;
            completed?: boolean;
            priority?: 'low' | 'medium' | 'high';
            content?: string;
        }) => {
            const data: Partial<Reminder> = {};

            if (reminderDate) {
                data.reminderDate = new Date(reminderDate);
            }

            if (completed !== undefined) {
                data.completed = completed;
            }

            if (priority) {
                data.priority = priority;
            }
            
            if (content !== undefined) {
                data.content = content;
            }

            return models.reminder.update({
                where: { id: Number(id) },
                data
            });
        },
        deleteReminder: async (_, { id }: { id: string }) => {
            await models.reminder.delete({ where: { id: Number(id) } });
            return true;
        }
    },
    Reminder: {
        note: async (reminder) => {
            return models.note.findUnique({ where: { id: reminder.noteId } });
        }
    }
};
