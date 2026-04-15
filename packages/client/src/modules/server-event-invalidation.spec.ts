import type { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from './query-key-factory';
import { invalidateQueriesForServerEvent } from './server-event-invalidation';

const createQueryClientMock = () => {
    return {
        invalidateQueries: vi.fn().mockResolvedValue(undefined),
    } as unknown as QueryClient;
};

describe('server-event-invalidation', () => {
    it('invalidates note collection queries for MCP note updates', async () => {
        const queryClient = createQueryClientMock();

        await invalidateQueriesForServerEvent(queryClient, {
            type: 'mcp.note.updated',
            source: 'mcp',
            noteId: '7',
            updatedAt: '2026-04-14T00:00:00.000Z',
        });

        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.notes.listAll(),
            exact: false,
        });
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.notes.tagListAll(),
            exact: false,
        });
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.notes.tagNameListAll(),
            exact: false,
        });
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.notes.pinned(),
            exact: true,
        });
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.notes.backReferencesAll(),
            exact: false,
        });
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.notes.graph(),
            exact: true,
        });
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.views.sectionNotesAll(),
            exact: false,
        });
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.tags.all(),
            exact: false,
        });
    });

    it('invalidates trash-related queries for MCP note deletes', async () => {
        const queryClient = createQueryClientMock();

        await invalidateQueriesForServerEvent(queryClient, {
            type: 'mcp.note.deleted',
            source: 'mcp',
            noteId: '11',
        });

        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.notes.trashAll(),
            exact: false,
        });
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.notes.tagNameListAll(),
            exact: false,
        });
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.views.sectionNotesAll(),
            exact: false,
        });
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.reminders.all(),
            exact: false,
        });
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.images.all(),
            exact: false,
        });
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: queryKeys.calendar.all(),
            exact: false,
        });
    });
});
