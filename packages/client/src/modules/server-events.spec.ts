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

    it('ignores invalid event payloads', () => {
        expect(parseServerEvent('{"type":"mcp.note.updated"}')).toBeNull();
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
});
