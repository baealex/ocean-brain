import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-key-factory';
import type { ServerEvent } from './server-events';

type QueryInvalidation = Parameters<QueryClient['invalidateQueries']>[0];

const noteChangeInvalidations: QueryInvalidation[] = [
    {
        queryKey: queryKeys.notes.listAll(),
        exact: false,
    },
    {
        queryKey: queryKeys.notes.tagListAll(),
        exact: false,
    },
    {
        queryKey: queryKeys.notes.tagNameListAll(),
        exact: false,
    },
    {
        queryKey: queryKeys.notes.pinned(),
        exact: true,
    },
    {
        queryKey: queryKeys.notes.backReferencesAll(),
        exact: false,
    },
    {
        queryKey: queryKeys.notes.graph(),
        exact: true,
    },
    {
        queryKey: queryKeys.views.sectionNotesAll(),
        exact: false,
    },
    {
        queryKey: queryKeys.tags.all(),
        exact: false,
    },
];

const propertyKeysInvalidation: QueryInvalidation = {
    queryKey: queryKeys.notes.propertyKeysAll(),
    exact: false,
};

const noteDeleteInvalidations: QueryInvalidation[] = [
    ...noteChangeInvalidations,
    propertyKeysInvalidation,
    {
        queryKey: queryKeys.notes.trashAll(),
        exact: false,
    },
    {
        queryKey: queryKeys.reminders.all(),
        exact: false,
    },
    {
        queryKey: queryKeys.images.all(),
        exact: false,
    },
    {
        queryKey: queryKeys.calendar.all(),
        exact: false,
    },
];

const invalidateMany = async (queryClient: QueryClient, invalidations: QueryInvalidation[]) => {
    await Promise.all(invalidations.map((invalidation) => queryClient.invalidateQueries(invalidation)));
};

export const invalidateQueriesForServerEvent = async (queryClient: QueryClient, event: ServerEvent) => {
    switch (event.type) {
        case 'mcp.note.created':
        case 'web.note.updated':
            await invalidateMany(queryClient, noteChangeInvalidations);
            return;
        case 'mcp.note.updated':
            await invalidateMany(queryClient, [...noteChangeInvalidations, propertyKeysInvalidation]);
            return;
        case 'mcp.note.deleted':
            await invalidateMany(queryClient, noteDeleteInvalidations);
            return;
    }
};
