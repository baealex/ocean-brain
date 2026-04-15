import { gql } from '~/modules/graphql.js';

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
        remindersInDateRange(dateRange: DateRangeInput): [Reminder!]!
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
