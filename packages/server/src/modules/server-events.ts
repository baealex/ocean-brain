import { EventEmitter } from 'node:events';

export type McpNoteServerEventType = 'mcp.note.created' | 'mcp.note.updated' | 'mcp.note.deleted';

interface BaseMcpNoteServerEvent {
    id: string;
    noteId: string;
    source: 'mcp';
}

export interface McpNoteCreatedServerEvent extends BaseMcpNoteServerEvent {
    type: 'mcp.note.created';
    updatedAt: string;
}

export interface McpNoteUpdatedServerEvent extends BaseMcpNoteServerEvent {
    type: 'mcp.note.updated';
    updatedAt: string;
}

export interface McpNoteDeletedServerEvent extends BaseMcpNoteServerEvent {
    type: 'mcp.note.deleted';
}

export type ServerEvent = McpNoteCreatedServerEvent | McpNoteUpdatedServerEvent | McpNoteDeletedServerEvent;

export type ServerEventInput =
    | Omit<McpNoteCreatedServerEvent, 'id'>
    | Omit<McpNoteUpdatedServerEvent, 'id'>
    | Omit<McpNoteDeletedServerEvent, 'id'>;

type ServerEventListener = (event: ServerEvent) => void;

const SERVER_EVENT_CHANNEL = 'server-event';

const serverEventEmitter = new EventEmitter();

serverEventEmitter.setMaxListeners(0);

let nextServerEventId = 1;

export const emitServerEvent = (event: ServerEventInput) => {
    const nextEvent = {
        id: String(nextServerEventId++),
        ...event,
    } as ServerEvent;

    serverEventEmitter.emit(SERVER_EVENT_CHANNEL, nextEvent);

    return nextEvent;
};

export const subscribeServerEvents = (listener: ServerEventListener) => {
    serverEventEmitter.on(SERVER_EVENT_CHANNEL, listener);

    return () => {
        serverEventEmitter.off(SERVER_EVENT_CHANNEL, listener);
    };
};

export const serializeServerEvent = (event: ServerEvent) => {
    return `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
};
