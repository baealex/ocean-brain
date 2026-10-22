import classNames from 'classnames';
import { type ComponentPropsWithoutRef, useEffect, useLayoutEffect, useRef } from 'react';
import { getIntegrationAppAppearance } from '~/modules/integration-app-appearance';
import {
    DEFAULT_INTEGRATION_APP_LOCATION,
    INTEGRATION_APP_BRIDGE_VERSION,
    normalizeIntegrationAppLocation,
} from '~/modules/integration-app-bridge';

export interface IntegrationAppFrameProps
    extends Omit<ComponentPropsWithoutRef<'iframe'>, 'referrerPolicy' | 'sandbox' | 'srcDoc' | 'title'> {
    appLocation?: string;
    onAppReady?: (contentWindow: Window) => void;
    onLocationChange?: (location: string) => void;
    onOpenNote?: (noteId: string) => void;
    sandbox?: string;
    title: string;
}

const isBridgeMessage = (event: MessageEvent, contentWindow: Window | null) =>
    event.origin === 'null' &&
    event.source === contentWindow &&
    typeof event.data === 'object' &&
    event.data !== null &&
    event.data.version === INTEGRATION_APP_BRIDGE_VERSION;

const sendHostContext = (contentWindow: Window, location: string) => {
    contentWindow.postMessage(
        {
            type: 'ocean-brain:host-context',
            version: INTEGRATION_APP_BRIDGE_VERSION,
            capabilities: ['location', 'open-note', 'appearance'],
            location,
            appearance: getIntegrationAppAppearance(),
        },
        '*',
    );
};

export function IntegrationAppFrame({
    appLocation = DEFAULT_INTEGRATION_APP_LOCATION,
    className,
    onAppReady,
    onLocationChange,
    onOpenNote,
    sandbox = 'allow-scripts allow-forms',
    title,
    ...iframeProps
}: IntegrationAppFrameProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const appReadyRef = useRef(false);
    const initialSourceRef = useRef(iframeProps.src);
    const location = normalizeIntegrationAppLocation(appLocation) ?? DEFAULT_INTEGRATION_APP_LOCATION;
    const latestLocationRef = useRef(location);
    latestLocationRef.current = location;

    useLayoutEffect(() => {
        const receiveAppMessage = (event: MessageEvent) => {
            const contentWindow = iframeRef.current?.contentWindow ?? null;
            if (!isBridgeMessage(event, contentWindow) || !contentWindow) return;

            if (event.data.type === 'ocean-brain:app-ready') {
                appReadyRef.current = true;
                sendHostContext(contentWindow, latestLocationRef.current);
                onAppReady?.(contentWindow);
                return;
            }
            if (event.data.type === 'ocean-brain:location-change') {
                const nextLocation = normalizeIntegrationAppLocation(event.data.location);
                if (nextLocation) onLocationChange?.(nextLocation);
                return;
            }
            if (event.data.type === 'ocean-brain:open-note') {
                const noteId = typeof event.data.noteId === 'string' ? event.data.noteId.trim() : '';
                if (/^[1-9]\d*$/.test(noteId) && noteId.length <= 200) onOpenNote?.(noteId);
            }
        };

        window.addEventListener('message', receiveAppMessage);
        return () => window.removeEventListener('message', receiveAppMessage);
    }, [onAppReady, onLocationChange, onOpenNote]);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            if (!appReadyRef.current) return;
            iframeRef.current?.contentWindow?.postMessage(
                {
                    type: 'ocean-brain:appearance',
                    version: INTEGRATION_APP_BRIDGE_VERSION,
                    appearance: getIntegrationAppAppearance(),
                },
                '*',
            );
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const contentWindow = iframeRef.current?.contentWindow;
        if (!contentWindow) return;
        contentWindow.postMessage(
            {
                type: 'ocean-brain:location',
                version: INTEGRATION_APP_BRIDGE_VERSION,
                location,
            },
            '*',
        );
    }, [location]);

    return (
        <iframe
            {...iframeProps}
            ref={iframeRef}
            src={initialSourceRef.current}
            title={title}
            sandbox={sandbox}
            referrerPolicy="no-referrer"
            className={classNames('border-0 bg-surface', className)}
        />
    );
}
