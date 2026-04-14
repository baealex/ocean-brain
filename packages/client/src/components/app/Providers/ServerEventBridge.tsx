import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { invalidateQueriesForServerEvent } from '~/modules/server-event-invalidation';
import {
    MCP_NOTE_SERVER_EVENT_TYPES,
    type McpNoteServerEventType,
    parseServerEvent,
    publishServerEvent,
} from '~/modules/server-events';

const createServerEventListener = (
    queryClient: ReturnType<typeof useQueryClient>,
    expectedType: McpNoteServerEventType,
): EventListener => {
    return (event) => {
        if (!(event instanceof MessageEvent) || typeof event.data !== 'string') {
            return;
        }

        const serverEvent = parseServerEvent(event.data);

        if (!serverEvent || serverEvent.type !== expectedType) {
            return;
        }

        publishServerEvent(serverEvent);
        void invalidateQueriesForServerEvent(queryClient, serverEvent);
    };
};

const ServerEventBridge = () => {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (typeof EventSource === 'undefined') {
            return;
        }

        const eventSource = new EventSource('/api/events');
        const cleanupListeners = MCP_NOTE_SERVER_EVENT_TYPES.map((eventType) => {
            const listener = createServerEventListener(queryClient, eventType);

            eventSource.addEventListener(eventType, listener);

            return () => {
                eventSource.removeEventListener(eventType, listener);
            };
        });

        return () => {
            cleanupListeners.forEach((cleanup) => {
                cleanup();
            });
            eventSource.close();
        };
    }, [queryClient]);

    return null;
};

export default ServerEventBridge;
