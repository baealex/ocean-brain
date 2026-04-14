export const MCP_NOTE_SERVER_EVENT_TYPES = ['mcp.note.created', 'mcp.note.updated', 'mcp.note.deleted'] as const;

export type McpNoteServerEventType = (typeof MCP_NOTE_SERVER_EVENT_TYPES)[number];

interface BaseMcpNoteServerEvent {
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

type ServerEventListener = (event: ServerEvent) => void;

const serverEventListeners = new Set<ServerEventListener>();

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

const isMcpNoteServerEvent = (value: unknown): value is ServerEvent => {
    if (
        !isRecord(value) ||
        value.source !== 'mcp' ||
        typeof value.noteId !== 'string' ||
        typeof value.type !== 'string'
    ) {
        return false;
    }

    if (value.type === 'mcp.note.deleted') {
        return true;
    }

    if (
        (value.type === 'mcp.note.created' || value.type === 'mcp.note.updated') &&
        typeof value.updatedAt === 'string'
    ) {
        return true;
    }

    return false;
};

export const parseServerEvent = (raw: string) => {
    try {
        const parsed = JSON.parse(raw);

        if (!isMcpNoteServerEvent(parsed)) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
};

export const publishServerEvent = (event: ServerEvent) => {
    serverEventListeners.forEach((listener) => {
        listener(event);
    });
};

export const subscribeServerEvent = (listener: ServerEventListener) => {
    serverEventListeners.add(listener);

    return () => {
        serverEventListeners.delete(listener);
    };
};
