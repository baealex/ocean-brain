import classNames from 'classnames';
import { type ComponentPropsWithoutRef, useCallback, useEffect, useRef, useState } from 'react';
import { issueProxiedAppAccess } from '~/apis/app-gateway.api';
import { Button, Text } from '~/components/ui';
import { DEFAULT_INTEGRATION_APP_LOCATION, normalizeIntegrationAppLocation } from '~/modules/integration-app-bridge';
import { IntegrationAppFrame } from './IntegrationAppFrame';

const ACCESS_REFRESH_LEEWAY_MS = 60_000;
const ACCESS_REFRESH_RETRY_MS = 10_000;

type FrameState = 'error' | 'loading' | 'ready';
interface ConnectionFrameState {
    connectionId: string;
    state: FrameState;
}

export interface ProxiedAppFrameProps
    extends Omit<ComponentPropsWithoutRef<'iframe'>, 'referrerPolicy' | 'sandbox' | 'src' | 'srcDoc' | 'title'> {
    appLocation?: string;
    connectionId: string;
    onLocationChange?: (location: string) => void;
    onOpenNote?: (noteId: string) => void;
    title: string;
}

export function ProxiedAppFrame({
    appLocation = DEFAULT_INTEGRATION_APP_LOCATION,
    connectionId,
    onLocationChange,
    onOpenNote,
    title,
    className,
    ...iframeProps
}: ProxiedAppFrameProps) {
    const contentWindowRef = useRef<Window | null>(null);
    const accessTokenRef = useRef<string | undefined>(undefined);
    const accessExpiresAtRef = useRef(0);
    const [connectionState, setConnectionState] = useState<ConnectionFrameState>({
        connectionId,
        state: 'loading',
    });
    const [retryVersion, setRetryVersion] = useState(0);
    const frameState = connectionState.connectionId === connectionId ? connectionState.state : 'loading';

    const sendAccessToken = useCallback((contentWindow = contentWindowRef.current) => {
        const token = accessTokenRef.current;
        if (!token || !contentWindow) return;
        contentWindow.postMessage({ type: 'ocean-brain:app-access', version: 1, token }, '*');
    }, []);
    const handleAppReady = useCallback(
        (contentWindow: Window) => {
            contentWindowRef.current = contentWindow;
            sendAccessToken(contentWindow);
        },
        [sendAccessToken],
    );

    useEffect(() => {
        let disposed = false;
        let refreshTimer: number | undefined;
        let requestController: AbortController | undefined;
        contentWindowRef.current = null;
        accessTokenRef.current = undefined;
        accessExpiresAtRef.current = 0;
        setConnectionState({ connectionId, state: 'loading' });

        const schedule = (delay: number) => {
            window.clearTimeout(refreshTimer);
            refreshTimer = window.setTimeout(() => void issueAccess(), delay);
        };
        const issueAccess = async () => {
            requestController?.abort();
            requestController = new AbortController();
            try {
                const access = await issueProxiedAppAccess(connectionId, requestController.signal);
                if (disposed) return;
                const expiresAt = Date.parse(access.expiresAt);
                if (
                    access.connectionId !== connectionId ||
                    !access.token ||
                    !Number.isFinite(expiresAt) ||
                    expiresAt <= Date.now()
                ) {
                    throw new Error('The app gateway returned an invalid access grant.');
                }
                accessTokenRef.current = access.token;
                accessExpiresAtRef.current = expiresAt;
                setConnectionState({ connectionId, state: 'ready' });
                sendAccessToken();
                schedule(Math.max(1_000, expiresAt - Date.now() - ACCESS_REFRESH_LEEWAY_MS));
            } catch {
                if (disposed) return;
                if (accessTokenRef.current && accessExpiresAtRef.current > Date.now()) {
                    schedule(ACCESS_REFRESH_RETRY_MS);
                    return;
                }
                accessTokenRef.current = undefined;
                setConnectionState({ connectionId, state: 'error' });
            }
        };

        void issueAccess();
        return () => {
            disposed = true;
            requestController?.abort();
            window.clearTimeout(refreshTimer);
        };
    }, [connectionId, retryVersion, sendAccessToken]);

    if (frameState === 'loading') {
        return (
            <div role="status" className={classNames('flex h-full items-center justify-center p-6', className)}>
                <Text as="p" tone="secondary">
                    Opening app…
                </Text>
            </div>
        );
    }
    if (frameState === 'error') {
        return (
            <div
                role="alert"
                className={classNames('flex h-full flex-col items-center justify-center gap-3 p-6', className)}
            >
                <Text as="p" tone="secondary">
                    Could not open this app.
                </Text>
                <Button size="sm" onClick={() => setRetryVersion((version) => version + 1)}>
                    Retry
                </Button>
            </div>
        );
    }

    const location = normalizeIntegrationAppLocation(appLocation) ?? DEFAULT_INTEGRATION_APP_LOCATION;

    return (
        <IntegrationAppFrame
            {...iframeProps}
            title={title}
            src={`/apps/${encodeURIComponent(connectionId)}${location}`}
            appLocation={location}
            onAppReady={handleAppReady}
            onLocationChange={onLocationChange}
            onOpenNote={onOpenNote}
            sandbox="allow-downloads allow-forms allow-modals allow-scripts allow-same-site-none-cookies"
            className={classNames(className)}
        />
    );
}
