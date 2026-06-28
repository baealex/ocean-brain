import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { redirectToLoginIfSessionExpired } from '~/modules/auth-session-recovery';
import { isLocalOnlyDemoMode } from '~/modules/demo-mode';
import { invalidateQueriesForServerEvent } from '~/modules/server-event-invalidation';
import {
    NOTE_SERVER_EVENT_TYPES,
    type NoteServerEventType,
    parseServerEvent,
    publishServerEvent,
    subscribeServerEvent,
} from '~/modules/server-events';

const createServerEventListener = (expectedType: NoteServerEventType): EventListener => {
    return (event) => {
        if (!(event instanceof MessageEvent) || typeof event.data !== 'string') {
            return;
        }

        const serverEvent = parseServerEvent(event.data);

        if (!serverEvent || serverEvent.type !== expectedType) {
            return;
        }

        publishServerEvent(serverEvent);
    };
};

const ServerEventBridge = () => {
    const queryClient = useQueryClient();

    useEffect(() => {
        return subscribeServerEvent((event) => {
            void invalidateQueriesForServerEvent(queryClient, event);
        });
    }, [queryClient]);

    useEffect(() => {
        if (isLocalOnlyDemoMode() || typeof EventSource === 'undefined') {
            return;
        }

        const eventSource = new EventSource('/api/events');
        let reconnectingAfterError = false;
        const authErrorListener = () => {
            reconnectingAfterError = true;
            void redirectToLoginIfSessionExpired();
        };
        const reconnectListener = () => {
            if (!reconnectingAfterError) {
                return;
            }

            reconnectingAfterError = false;
            void redirectToLoginIfSessionExpired();
        };
        const cleanupListeners = NOTE_SERVER_EVENT_TYPES.map((eventType) => {
            const listener = createServerEventListener(eventType);

            eventSource.addEventListener(eventType, listener);

            return () => {
                eventSource.removeEventListener(eventType, listener);
            };
        });

        eventSource.addEventListener('error', authErrorListener);
        eventSource.addEventListener('open', reconnectListener);

        return () => {
            cleanupListeners.forEach((cleanup) => {
                cleanup();
            });
            eventSource.removeEventListener('error', authErrorListener);
            eventSource.removeEventListener('open', reconnectListener);
            eventSource.close();
        };
    }, []);

    return null;
};

export default ServerEventBridge;
