import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-key-factory';
import type { ServerEvent } from './server-events';

export const invalidateQueriesForServerEvent = async (queryClient: QueryClient, event: ServerEvent) => {
    switch (event.type) {
        case 'mcp.note.created':
        case 'mcp.note.updated':
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.listAll(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.tagListAll(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.pinned(),
                    exact: true,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.backReferencesAll(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.graph(),
                    exact: true,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.tags.all(),
                    exact: false,
                }),
            ]);
            return;
        case 'mcp.note.deleted':
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.listAll(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.tagListAll(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.trashAll(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.pinned(),
                    exact: true,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.backReferencesAll(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notes.graph(),
                    exact: true,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.tags.all(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.reminders.all(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.images.all(),
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.calendar.all(),
                    exact: false,
                }),
            ]);
            return;
    }
};
