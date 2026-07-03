// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { parseServerEvent, publishServerEvent, subscribeServerEvent } from './server-events';

describe('server-events', () => {
    it('parses valid MCP note events', () => {
        expect(
            parseServerEvent(
                JSON.stringify({
                    type: 'mcp.note.updated',
                    source: 'mcp',
                    noteId: '7',
                    updatedAt: '2026-04-14T00:00:00.000Z',
                }),
            ),
        ).toEqual({
            type: 'mcp.note.updated',
            source: 'mcp',
            noteId: '7',
            updatedAt: '2026-04-14T00:00:00.000Z',
        });
    });

    it('parses valid web note update events', () => {
        expect(
            parseServerEvent(
                JSON.stringify({
                    type: 'web.note.updated',
                    source: 'web',
                    noteId: '7',
                    updatedAt: '1779700304864',
                    editSessionId: 'editor-a',
                    eventId: 'event-1',
                }),
            ),
        ).toEqual({
            type: 'web.note.updated',
            source: 'web',
            noteId: '7',
            updatedAt: '1779700304864',
            editSessionId: 'editor-a',
            eventId: 'event-1',
        });
    });

    it('ignores invalid event payloads', () => {
        expect(parseServerEvent('{"type":"mcp.note.updated"}')).toBeNull();
        expect(parseServerEvent('{"type":"web.note.updated","source":"web","noteId":"7"}')).toBeNull();
        expect(parseServerEvent('not-json')).toBeNull();
    });

    it('publishes events to subscribers', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeServerEvent(listener);

        publishServerEvent({
            type: 'mcp.note.deleted',
            source: 'mcp',
            noteId: '11',
        });

        unsubscribe();

        expect(listener).toHaveBeenCalledWith({
            type: 'mcp.note.deleted',
            source: 'mcp',
            noteId: '11',
        });
    });

    it('deduplicates web events by event id', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeServerEvent(listener);
        const event = {
            type: 'web.note.updated' as const,
            source: 'web' as const,
            noteId: '11',
            updatedAt: '1779700304864',
            eventId: 'event-2',
        };

        publishServerEvent(event);
        publishServerEvent(event);
        unsubscribe();

        expect(listener).toHaveBeenCalledTimes(1);
    });
});
