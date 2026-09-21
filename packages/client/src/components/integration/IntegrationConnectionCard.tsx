import { Link } from '@tanstack/react-router';
import type { IntegrationConnection } from '~/apis/integration.api';
import * as Icon from '~/components/icon';
import { Button, Text } from '~/components/ui';
import { getIntegrationStatus } from '~/modules/integration-status';
import { recentTimeSince } from '~/modules/time';
import { INTEGRATION_ROUTE, SETTINGS_INTEGRATION_DETAIL_ROUTE, SETTINGS_MCP_ROUTE } from '~/modules/url';

export default function IntegrationConnectionCard({ integration }: { integration: IntegrationConnection }) {
    const status = getIntegrationStatus(integration);
    const needsSetup = ['address', 'setup', 'permissions'].includes(status.kind);
    const needsAttention = status.kind === 'failed' || status.kind === 'overdue';
    const canOpen = integration.enabled && integration.manifest.launch && !needsSetup;
    const isNewMcp = integration.native && !integration.token;
    const summary = isNewMcp
        ? 'Use your notes in AI clients.'
        : status.kind === 'recorded' && integration.token?.lastUsedAt
          ? `Last used ${recentTimeSince(new Date(integration.token.lastUsedAt).getTime())}`
          : status.label;
    return (
        <section aria-label={integration.manifest.name} className="surface-base flex items-start gap-3 px-4 py-3.5">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] border border-border-subtle bg-muted text-fg-secondary">
                {integration.native ? (
                    <Icon.Code aria-hidden="true" className="h-6 w-6" />
                ) : (
                    <Icon.LinkIcon aria-hidden="true" className="h-6 w-6" />
                )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-0.5 pt-0.5">
                    <Text as="h2" weight="medium" className="break-words">
                        {integration.manifest.name}
                    </Text>
                    <Text as="p" variant="meta" tone={needsAttention ? 'error' : 'secondary'}>
                        {summary}
                    </Text>
                    {needsAttention && status.detail && (
                        <Text as="p" variant="meta" tone="secondary" className="break-words">
                            {status.detail}
                        </Text>
                    )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                    {isNewMcp && (
                        <Button asChild variant="subtle" size="sm">
                            <Link to={SETTINGS_MCP_ROUTE}>Connect AI client</Link>
                        </Button>
                    )}
                    {needsSetup && !isNewMcp && (
                        <Button asChild variant="subtle" size="sm">
                            <Link
                                to={SETTINGS_INTEGRATION_DETAIL_ROUTE}
                                params={{ connectionId: integration.id }}
                                search={{ setup: true }}
                            >
                                Connect
                            </Link>
                        </Button>
                    )}
                    {canOpen && (
                        <Button asChild variant="subtle" size="sm">
                            <Link to={INTEGRATION_ROUTE} params={{ connectionId: integration.id }}>
                                Open app
                            </Link>
                        </Button>
                    )}
                    {!isNewMcp && (
                        <Button asChild variant={canOpen || needsSetup ? 'ghost' : 'subtle'} size="sm">
                            <Link
                                to={SETTINGS_INTEGRATION_DETAIL_ROUTE}
                                params={{ connectionId: integration.id }}
                                search={{}}
                            >
                                Settings
                                <Icon.ChevronRight aria-hidden="true" className="h-4 w-4" />
                            </Link>
                        </Button>
                    )}
                </div>
            </div>
        </section>
    );
}
