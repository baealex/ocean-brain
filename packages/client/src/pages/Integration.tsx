import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { fetchIntegrations } from '~/apis/integration.api';
import * as Icon from '~/components/icon';
import { PageLayout } from '~/components/shared';
import { Button, Text } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';
import { INTEGRATION_ROUTE, SETTINGS_INTEGRATIONS_ROUTE } from '~/modules/url';

export default function IntegrationPage() {
    const { connectionId } = useParams({ from: INTEGRATION_ROUTE });
    const query = useQuery({ queryKey: queryKeys.integrations.list(), queryFn: fetchIntegrations });
    const integration = query.data?.find((item) => item.id === connectionId);
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
                    <Link to={SETTINGS_INTEGRATIONS_ROUTE} search={{ connection: connectionId }}>
                        Manage integrations
                    </Link>
                </PageLayout>
            </div>
        );
    const launch = integration.manifest.launch;
    const url = new URL(launch.url);
    const canEmbed =
        launch.mode === 'iframe' &&
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
                                to={SETTINGS_INTEGRATIONS_ROUTE}
                                search={{ connection: connectionId }}
                                title="Manage access"
                            >
                                <Icon.Gear aria-hidden="true" className="h-4 w-4" />
                                <span className="sr-only sm:not-sr-only">Manage access</span>
                            </Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm" className="min-h-11">
                            <a href={launch.url} target="_blank" rel="noopener noreferrer" title="Open in a new tab">
                                <Icon.ArrowSquareOut aria-hidden="true" className="h-4 w-4" />
                                <span className="sr-only sm:not-sr-only">Open in a new tab</span>
                            </a>
                        </Button>
                    </div>
                </header>
                {canEmbed ? (
                    <iframe
                        title={integration.manifest.name}
                        src={launch.url}
                        sandbox="allow-scripts allow-forms"
                        referrerPolicy="no-referrer"
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
