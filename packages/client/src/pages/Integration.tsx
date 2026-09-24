import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';
import { fetchIntegrations } from '~/apis/integration.api';
import { IntegrationAppFrame, ProxiedAppFrame } from '~/components/app';
import * as Icon from '~/components/icon';
import { PageLayout } from '~/components/shared';
import { Button, Text } from '~/components/ui';
import { DEFAULT_INTEGRATION_APP_LOCATION, resolveIntegrationAppSource } from '~/modules/integration-app-bridge';
import { queryKeys } from '~/modules/query-key-factory';
import { INTEGRATION_ROUTE, NOTE_ROUTE, SETTINGS_INTEGRATION_DETAIL_ROUTE } from '~/modules/url';

export default function IntegrationPage() {
    const { connectionId } = useParams({ from: INTEGRATION_ROUTE });
    const { app } = useSearch({ from: INTEGRATION_ROUTE });
    const navigate = useNavigate();
    const query = useQuery({ queryKey: queryKeys.integrations.list(), queryFn: fetchIntegrations });
    const integration = query.data?.find((item) => item.id === connectionId);
    const appLocation = app ?? DEFAULT_INTEGRATION_APP_LOCATION;
    const handleLocationChange = useCallback(
        (location: string) => {
            void navigate({
                to: INTEGRATION_ROUTE,
                params: { connectionId },
                search: location === DEFAULT_INTEGRATION_APP_LOCATION ? {} : { app: location },
            });
        },
        [connectionId, navigate],
    );
    const handleOpenNote = useCallback(
        (noteId: string) => {
            void navigate({ to: NOTE_ROUTE, params: { id: noteId } });
        },
        [navigate],
    );
    if (query.isPending)
        return (
            <div className="p-4">
                <PageLayout title="External app">
                    <Text as="p">Loading app…</Text>
                </PageLayout>
            </div>
        );
    if (query.error)
        return (
            <div className="p-4">
                <PageLayout title="External app">
                    <p role="alert">Could not load this app.</p>
                    <Button onClick={() => query.refetch()}>Retry</Button>
                </PageLayout>
            </div>
        );
    if (!integration || !integration.enabled || !integration.manifest.launch)
        return (
            <div className="p-4">
                <PageLayout title="App unavailable">
                    <Text as="p">This app is disconnected, disabled, or has no page.</Text>
                    <Link to={SETTINGS_INTEGRATION_DETAIL_ROUTE} params={{ connectionId }}>
                        Manage integrations
                    </Link>
                </PageLayout>
            </div>
        );
    const launch = integration.manifest.launch;
    const proxied = launch.mode === 'proxied';
    const url = proxied ? undefined : new URL(launch.url);
    const canEmbed =
        !proxied &&
        launch.mode === 'iframe' &&
        url !== undefined &&
        url.origin !== window.location.origin &&
        !(window.location.protocol === 'https:' && url.protocol !== 'https:');
    return (
        <PageLayout title={integration.manifest.name} variant="none">
            <section aria-label="External app workspace" className="flex min-h-0 min-w-0 flex-1 flex-col">
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-4 py-1">
                    <Text as="h1" variant="meta" weight="medium" className="min-w-0 truncate">
                        {integration.manifest.name}
                    </Text>
                    <div className="flex shrink-0 items-center gap-1">
                        <Button asChild variant="ghost" size="sm" className="min-h-11">
                            <Link
                                to={SETTINGS_INTEGRATION_DETAIL_ROUTE}
                                params={{ connectionId }}
                                search={{ section: 'access' }}
                                title="Manage access"
                            >
                                <Icon.Gear aria-hidden="true" className="h-4 w-4" />
                                <span className="sr-only sm:not-sr-only">Manage access</span>
                            </Link>
                        </Button>
                        {!proxied && (
                            <Button asChild variant="ghost" size="sm" className="min-h-11">
                                <a
                                    href={launch.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Open in a new tab"
                                >
                                    <Icon.ArrowSquareOut aria-hidden="true" className="h-4 w-4" />
                                    <span className="sr-only sm:not-sr-only">Open in a new tab</span>
                                </a>
                            </Button>
                        )}
                    </div>
                </header>
                {proxied && !integration.proxyConfigured ? (
                    <div className="flex flex-1 items-center justify-center p-6">
                        <Text as="p" tone="secondary">
                            Configure this app's private URL before opening it through Ocean Brain.
                        </Text>
                    </div>
                ) : proxied ? (
                    <ProxiedAppFrame
                        key={integration.id}
                        connectionId={integration.id}
                        appLocation={appLocation}
                        onLocationChange={handleLocationChange}
                        onOpenNote={handleOpenNote}
                        title={integration.manifest.name}
                        className="min-h-0 w-full flex-1"
                    />
                ) : canEmbed ? (
                    <IntegrationAppFrame
                        key={`${integration.id}:${url.href}`}
                        title={integration.manifest.name}
                        src={resolveIntegrationAppSource(url.href, appLocation)}
                        appLocation={appLocation}
                        onLocationChange={handleLocationChange}
                        onOpenNote={handleOpenNote}
                        className="min-h-0 w-full flex-1 border-0 bg-surface"
                    />
                ) : (
                    <div className="flex flex-1 items-center justify-center p-6">
                        <Text as="p" tone="secondary">
                            Open this app in a new tab to use its service.
                        </Text>
                    </div>
                )}
            </section>
        </PageLayout>
    );
}
