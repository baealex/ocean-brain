import { QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';

import { redirectToLoginIfSessionExpired } from '~/modules/auth-session-recovery';
import { queryKeys } from '~/modules/query-key-factory';
import { createTestQueryClient } from '~/test/test-utils';

import ServerEventBridge from './ServerEventBridge';

vi.mock('~/modules/auth-session-recovery', () => ({
    redirectToLoginIfSessionExpired: vi.fn(),
}));

vi.mock('~/modules/demo-mode', () => ({
    isLocalOnlyDemoMode: () => false,
}));

class FakeEventSource {
    static instances: FakeEventSource[] = [];

    readonly listeners = new Map<string, Set<EventListener>>();
    readonly url: string;
    closed = false;

    constructor(url: string) {
        this.url = url;
        FakeEventSource.instances.push(this);
    }

    addEventListener(type: string, listener: EventListener) {
        const listeners = this.listeners.get(type) ?? new Set<EventListener>();
        listeners.add(listener);
        this.listeners.set(type, listeners);
    }

    removeEventListener(type: string, listener: EventListener) {
        this.listeners.get(type)?.delete(listener);
    }

    dispatch(type: string, event: Event) {
        this.listeners.get(type)?.forEach((listener) => listener(event));
    }

    close() {
        this.closed = true;
    }
}

const renderBridge = () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const view = render(
        <QueryClientProvider client={queryClient}>
            <ServerEventBridge />
        </QueryClientProvider>,
    );

    return { ...view, invalidateSpy };
};

describe('<ServerEventBridge />', () => {
    beforeEach(() => {
        FakeEventSource.instances = [];
        vi.stubGlobal('EventSource', FakeEventSource);
        vi.mocked(redirectToLoginIfSessionExpired).mockResolvedValue('active');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('publishes valid EventSource messages to query invalidation subscribers', async () => {
        const { invalidateSpy } = renderBridge();
        const eventSource = FakeEventSource.instances[0];

        eventSource.dispatch(
            'mcp.note.updated',
            new MessageEvent('mcp.note.updated', {
                data: JSON.stringify({
                    type: 'mcp.note.updated',
                    source: 'mcp',
                    noteId: '7',
                    updatedAt: '2026-08-08T00:00:00.000Z',
                }),
            }),
        );

        await waitFor(() => {
            expect(invalidateSpy).toHaveBeenCalledWith({
                queryKey: queryKeys.notes.listAll(),
                exact: false,
            });
        });
        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: queryKeys.notes.propertyKeysAll(),
            exact: false,
        });
        expect(eventSource.url).toBe('/api/events');
    });

    it('checks session state after an EventSource error and its next reconnect', async () => {
        renderBridge();
        const eventSource = FakeEventSource.instances[0];

        eventSource.dispatch('error', new Event('error'));
        await waitFor(() => {
            expect(redirectToLoginIfSessionExpired).toHaveBeenCalledTimes(1);
        });
        eventSource.dispatch('open', new Event('open'));

        await waitFor(() => {
            expect(redirectToLoginIfSessionExpired).toHaveBeenCalledTimes(2);
        });
    });

    it('removes EventSource listeners and closes the connection on unmount', () => {
        const { unmount } = renderBridge();
        const eventSource = FakeEventSource.instances[0];

        unmount();

        expect(eventSource.closed).toBe(true);
        expect([...eventSource.listeners.values()].every((listeners) => listeners.size === 0)).toBe(true);
    });
});
