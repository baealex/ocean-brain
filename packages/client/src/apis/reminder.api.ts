import type { Reminder, Reminders as ReminderCollection, ReminderPriority } from '~/models/reminder.model';
import type { WorkspaceScope } from '~/models/workspace.model';
import { graphQuery } from '~/modules/graph-query';
import type { Pagination } from '~/types';

export interface ReminderPaginationParams {
    scope?: WorkspaceScope;
    limit?: number;
    offset?: number;
}

export type ReminderStatus = 'open' | 'completed';
export type ReminderSortBy = 'reminderDate' | 'updatedAt';
export type ReminderSortOrder = 'asc' | 'desc';

export interface ReminderListFilter {
    status: ReminderStatus;
    priority?: ReminderPriority;
    start?: string;
    end?: string;
    sortBy?: ReminderSortBy;
    sortOrder?: ReminderSortOrder;
}

export interface FetchRemindersParams extends ReminderPaginationParams {
    filter: ReminderListFilter;
}

export interface FetchOpenReminderOverviewParams {
    scope?: WorkspaceScope;
    now: string;
    tomorrow: string;
    priority?: ReminderPriority;
    limit?: number;
}

export interface OpenReminderOverview {
    overdue: ReminderCollection;
    today: ReminderCollection;
    upcoming: ReminderCollection;
}

const toPaginationInput = (params: ReminderPaginationParams = {}): Pagination => {
    return {
        limit: params.limit ?? 10,
        offset: params.offset ?? 0,
    };
};

const reminderCollectionSelection = `
    totalCount
    reminders {
        id
        noteId
        reminderDate
        priority
        content
        completed
        createdAt
        updatedAt
        note {
            id
            title
        }
    }
`;

export const fetchNoteReminders = async (noteId: string, pagination?: ReminderPaginationParams) => {
    return graphQuery<{ noteReminders: ReminderCollection }, { noteId: string; pagination: Pagination }>(
        `
        query FetchNoteReminders($noteId: ID!, $pagination: PaginationInput) {
            noteReminders(noteId: $noteId, pagination: $pagination) {
                totalCount
                reminders {
                    id
                    noteId
                    reminderDate
                    priority
                    content
                    completed
                    createdAt
                    updatedAt
                }
            }
        }
    `,
        {
            noteId,
            pagination: toPaginationInput(pagination),
        },
    );
};

export const fetchUpcomingReminders = async (pagination?: ReminderPaginationParams) => {
    return graphQuery<{ upcomingReminders: ReminderCollection }, { pagination: Pagination; scope?: WorkspaceScope }>(
        `
        query FetchUpcomingReminders($pagination: PaginationInput, $scope: WorkspaceScopeInput) {
            upcomingReminders(pagination: $pagination, scope: $scope) {
                totalCount
                reminders {
                    id
                    noteId
                    reminderDate
                    priority
                    content
                    completed
                    createdAt
                    updatedAt
                    note {
                        id
                        title
                    }
                }
            }
        }
    `,
        { pagination: toPaginationInput(pagination), ...(pagination?.scope ? { scope: pagination.scope } : {}) },
    );
};

export const fetchReminders = async ({ filter, limit = 25, offset = 0, scope }: FetchRemindersParams) => {
    return graphQuery<
        { reminders: ReminderCollection },
        { filter: ReminderListFilter; pagination: Pagination; scope?: WorkspaceScope }
    >(
        `
        query FetchReminders($filter: ReminderFilterInput!, $pagination: PaginationInput, $scope: WorkspaceScopeInput) {
            reminders(filter: $filter, pagination: $pagination, scope: $scope) {
                ${reminderCollectionSelection}
            }
        }
    `,
        {
            ...(scope ? { scope } : {}),
            filter,
            pagination: { limit, offset },
        },
    );
};

export const fetchOpenReminderOverview = async ({
    scope,
    now,
    tomorrow,
    priority,
    limit = 5,
}: FetchOpenReminderOverviewParams) => {
    const baseFilter = {
        status: 'open' as const,
        ...(priority ? { priority } : {}),
    };
    const overdueFilter: ReminderListFilter = {
        ...baseFilter,
        end: now,
        sortBy: 'reminderDate',
        sortOrder: 'desc',
    };
    const todayFilter: ReminderListFilter = {
        ...baseFilter,
        start: now,
        end: tomorrow,
        sortBy: 'reminderDate',
        sortOrder: 'asc',
    };
    const upcomingFilter: ReminderListFilter = {
        ...baseFilter,
        start: tomorrow,
        sortBy: 'reminderDate',
        sortOrder: 'asc',
    };

    return graphQuery<
        OpenReminderOverview,
        {
            scope?: WorkspaceScope;
            overdueFilter: ReminderListFilter;
            todayFilter: ReminderListFilter;
            upcomingFilter: ReminderListFilter;
            pagination: Pagination;
        }
    >(
        `
        query FetchOpenReminderOverview(
            $overdueFilter: ReminderFilterInput!
            $todayFilter: ReminderFilterInput!
            $upcomingFilter: ReminderFilterInput!
            $pagination: PaginationInput
            $scope: WorkspaceScopeInput
        ) {
            overdue: reminders(filter: $overdueFilter, pagination: $pagination, scope: $scope) {
                ${reminderCollectionSelection}
            }
            today: reminders(filter: $todayFilter, pagination: $pagination, scope: $scope) {
                ${reminderCollectionSelection}
            }
            upcoming: reminders(filter: $upcomingFilter, pagination: $pagination, scope: $scope) {
                ${reminderCollectionSelection}
            }
        }
    `,
        {
            ...(scope ? { scope } : {}),
            overdueFilter,
            todayFilter,
            upcomingFilter,
            pagination: { limit, offset: 0 },
        },
    );
};

export interface CreateReminderParams {
    noteId: string;
    reminderDate: Date;
    priority?: ReminderPriority;
    content?: string;
}

export const createReminder = async (params: CreateReminderParams) => {
    const { noteId, reminderDate, priority = 'medium', content } = params;

    return graphQuery<
        { createReminder: Reminder },
        {
            noteId: string;
            reminderDate: string;
            priority: ReminderPriority;
            content?: string;
        }
    >(
        `
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
    `,
        {
            noteId,
            reminderDate: reminderDate.toISOString(),
            priority,
            content,
        },
    );
};

export interface UpdateReminderParams {
    id: string;
    reminderDate?: Date;
    completed?: boolean;
    priority?: ReminderPriority;
    content?: string;
}

interface UpdateReminderVariables {
    id: string;
    reminderDate?: string;
    completed?: boolean;
    priority?: ReminderPriority;
    content?: string;
}

export const updateReminder = async ({ id, reminderDate, completed, priority, content }: UpdateReminderParams) => {
    const variables: UpdateReminderVariables = { id };
    if (reminderDate) variables.reminderDate = reminderDate.toISOString();
    if (completed !== undefined) variables.completed = completed;
    if (priority) variables.priority = priority;
    if (content !== undefined) variables.content = content;

    return graphQuery<{ updateReminder: Reminder }, UpdateReminderVariables>(
        `
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
    `,
        variables,
    );
};

export const deleteReminder = async (id: string) => {
    return graphQuery<{ deleteReminder: boolean }, { id: string }>(
        `
        mutation DeleteReminder($id: ID!) {
            deleteReminder(id: $id)
        }
    `,
        { id },
    );
};

export const fetchRemindersInDateRange = (dateRange: { start: string; end: string }, scope?: WorkspaceScope) =>
    graphQuery<{ remindersInDateRange: Reminder[] }>(
        `
    query RemindersInDateRange($dateRange: DateRangeInput!, $scope: WorkspaceScopeInput) {
        remindersInDateRange(dateRange: $dateRange, scope: $scope) { id noteId reminderDate completed priority content note { id title } }
    }
`,
        { dateRange, ...(scope ? { scope } : {}) },
    );
