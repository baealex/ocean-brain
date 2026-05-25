export const MCP_NOTE_SERVER_EVENT_TYPES = ['mcp.note.created', 'mcp.note.updated', 'mcp.note.deleted'] as const;
export const WEB_NOTE_SERVER_EVENT_TYPES = ['web.note.updated'] as const;
export const NOTE_SERVER_EVENT_TYPES = [...MCP_NOTE_SERVER_EVENT_TYPES, ...WEB_NOTE_SERVER_EVENT_TYPES] as const;

export type McpNoteServerEventType = (typeof MCP_NOTE_SERVER_EVENT_TYPES)[number];
export type WebNoteServerEventType = (typeof WEB_NOTE_SERVER_EVENT_TYPES)[number];
export type NoteServerEventType = (typeof NOTE_SERVER_EVENT_TYPES)[number];

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

interface BaseWebNoteServerEvent {
    noteId: string;
    source: 'web';
    editSessionId?: string;
    eventId?: string;
}

export interface WebNoteUpdatedServerEvent extends BaseWebNoteServerEvent {
    type: 'web.note.updated';
    updatedAt: string;
}

export type ServerEvent =
    | McpNoteCreatedServerEvent
    | McpNoteUpdatedServerEvent
    | McpNoteDeletedServerEvent
    | WebNoteUpdatedServerEvent;

type ServerEventListener = (event: ServerEvent) => void;

const serverEventListeners = new Set<ServerEventListener>();
const WEB_NOTE_EVENT_CHANNEL = 'ocean-brain:web-note-events';
const WEB_NOTE_EVENT_STORAGE_KEY = 'ocean-brain:web-note-event';
const seenWebEventIds = new Set<string>();

let webNoteEventBridgeReady = false;
let webNoteEventChannel: BroadcastChannel | null = null;

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

const isWebNoteServerEvent = (value: unknown): value is WebNoteUpdatedServerEvent => {
    if (
        !isRecord(value) ||
        value.source !== 'web' ||
        value.type !== 'web.note.updated' ||
        typeof value.noteId !== 'string' ||
        typeof value.updatedAt !== 'string'
    ) {
        return false;
    }

    if (value.editSessionId !== undefined && typeof value.editSessionId !== 'string') {
        return false;
    }

    if (value.eventId !== undefined && typeof value.eventId !== 'string') {
        return false;
    }

    return true;
};

const isServerEvent = (value: unknown): value is ServerEvent => {
    return isMcpNoteServerEvent(value) || isWebNoteServerEvent(value);
};

const parseServerEventValue = (value: unknown) => {
    return isServerEvent(value) ? value : null;
};

export const parseServerEvent = (raw: string) => {
    try {
        const parsed = JSON.parse(raw);

        return parseServerEventValue(parsed);
    } catch {
        return null;
    }
};

const shouldSkipDuplicateEvent = (event: ServerEvent) => {
    if (event.source !== 'web' || !event.eventId) {
        return false;
    }

    if (seenWebEventIds.has(event.eventId)) {
        return true;
    }

    seenWebEventIds.add(event.eventId);

    if (seenWebEventIds.size > 200) {
        seenWebEventIds.clear();
        seenWebEventIds.add(event.eventId);
    }

    return false;
};

export const publishServerEvent = (event: ServerEvent) => {
    if (shouldSkipDuplicateEvent(event)) {
        return;
    }

    serverEventListeners.forEach((listener) => {
        listener(event);
    });
};

const handleWebNoteEventPayload = (value: unknown) => {
    const event = parseServerEventValue(value);

    if (!event || event.source !== 'web') {
        return;
    }

    publishServerEvent(event);
};

const ensureWebNoteEventBridge = () => {
    if (webNoteEventBridgeReady || typeof window === 'undefined') {
        return;
    }

    webNoteEventBridgeReady = true;

    if (typeof BroadcastChannel !== 'undefined') {
        webNoteEventChannel = new BroadcastChannel(WEB_NOTE_EVENT_CHANNEL);
        webNoteEventChannel.onmessage = (event) => {
            handleWebNoteEventPayload(event.data);
        };
    }

    window.addEventListener('storage', (event) => {
        if (event.key !== WEB_NOTE_EVENT_STORAGE_KEY || !event.newValue) {
            return;
        }

        const parsed = parseServerEvent(event.newValue);

        if (parsed?.source === 'web') {
            publishServerEvent(parsed);
        }
    });
};

export const publishClientNoteUpdatedEvent = ({
    noteId,
    updatedAt,
    editSessionId,
}: {
    noteId: string;
    updatedAt: string;
    editSessionId?: string;
}) => {
    if (typeof window === 'undefined') {
        return;
    }

    ensureWebNoteEventBridge();

    const event: WebNoteUpdatedServerEvent = {
        type: 'web.note.updated',
        source: 'web',
        noteId,
        updatedAt,
        ...(editSessionId ? { editSessionId } : {}),
        eventId: `${Date.now()}:${Math.random().toString(36).slice(2)}`,
    };

    webNoteEventChannel?.postMessage(event);

    try {
        window.localStorage.setItem(WEB_NOTE_EVENT_STORAGE_KEY, JSON.stringify(event));
    } catch {
        // Cross-tab notification is best-effort; the guarded write still protects the note.
    }
};

export const subscribeServerEvent = (listener: ServerEventListener) => {
    ensureWebNoteEventBridge();
    serverEventListeners.add(listener);

    return () => {
        serverEventListeners.delete(listener);
    };
};
