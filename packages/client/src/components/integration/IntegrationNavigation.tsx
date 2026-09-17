import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { fetchIntegrations } from '~/apis/integration.api';
import * as Icon from '~/components/icon';
import { queryKeys } from '~/modules/query-key-factory';
import { INTEGRATION_ROUTE } from '~/modules/url';

export default function IntegrationNavigation() {
    const { data = [] } = useQuery({ queryKey: queryKeys.integrations.list(), queryFn: fetchIntegrations });
    return data
        .filter((integration) => integration.enabled && integration.pinned && integration.manifest.launch)
        .map((integration) => (
            <Link
                key={integration.id}
                to={INTEGRATION_ROUTE}
                params={{ connectionId: integration.id }}
                title={integration.manifest.description}
                className="flex shrink-0 items-center gap-2 border-l border-border-subtle px-3 py-2 text-sm text-fg-secondary hover:text-fg-default"
            >
                <Icon.LinkIcon className="size-5" />
                <span>{integration.manifest.name}</span>
            </Link>
        ));
}
