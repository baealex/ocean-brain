import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { fetchIntegrations } from '~/apis/integration.api';
import * as Icon from '~/components/icon';
import IntegrationConnectionCard from '~/components/integration/IntegrationConnectionCard';
import { PageLayout } from '~/components/shared';
import { Button, Text } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';
import { SETTINGS_INTEGRATION_CONNECT_ROUTE } from '~/modules/url';

export default function IntegrationsSettings() {
    const query = useQuery({
        queryKey: queryKeys.integrations.list(),
        queryFn: fetchIntegrations,
        refetchInterval: 10_000,
    });
    const connections = query.data;

    return (
        <PageLayout
            title="Integrations"
            headerRight={
                <Button asChild className="w-full sm:w-auto">
                    <Link to={SETTINGS_INTEGRATION_CONNECT_ROUTE}>
                        <Icon.Plus aria-hidden="true" className="h-4 w-4" />
                        Connect app
                    </Link>
                </Button>
            }
        >
            <div className="flex flex-col gap-3">
                {query.isPending && <Text as="p">Loading integrations…</Text>}
                {query.error && (
                    <div role="alert" className="flex flex-wrap items-center gap-3">
                        <Text as="p" variant="meta" tone="error">
                            {query.data
                                ? 'Could not refresh. Status may be out of date.'
                                : 'Could not load integrations.'}
                        </Text>
                        <Button variant="subtle" size="sm" onClick={() => query.refetch()}>
                            Retry
                        </Button>
                    </div>
                )}
                {connections?.map((integration) => (
                    <IntegrationConnectionCard key={integration.id} integration={integration} />
                ))}
                {connections?.length === 0 && (
                    <div className="surface-base border-dashed p-6 text-center">
                        <Text as="p" weight="medium">
                            No apps connected
                        </Text>
                        <Text as="p" variant="meta" tone="secondary">
                            Connect an AI client or an external app.
                        </Text>
                    </div>
                )}
            </div>
        </PageLayout>
    );
}
