import { useQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useState } from 'react';
import {
    disconnectIntegration,
    fetchIntegrations,
    getIntegrationErrorMessage,
    updateIntegration,
} from '~/apis/integration.api';
import * as Icon from '~/components/icon';
import IntegrationAccess from '~/components/integration/IntegrationAccess';
import IntegrationActivity from '~/components/integration/IntegrationActivity';
import IntegrationFirstTask from '~/components/integration/IntegrationFirstTask';
import IntegrationManifestEditor from '~/components/integration/IntegrationManifestEditor';
import IntegrationSetup from '~/components/integration/IntegrationSetup';
import IntegrationToken from '~/components/integration/IntegrationToken';
import useIntegrationActions from '~/components/integration/useIntegrationActions';
import { PageLayout, SurfaceCard } from '~/components/shared';
import PageBackLink from '~/components/shared/PageBackLink';
import {
    Button,
    Dialog,
    DialogBody,
    DialogContent,
    DialogHeader,
    Label,
    Switch,
    Text,
    useConfirm,
} from '~/components/ui';
import { getIntegrationStatus } from '~/modules/integration-status';
import { queryKeys } from '~/modules/query-key-factory';
import {
    INTEGRATION_ROUTE,
    SETTINGS_INTEGRATION_DETAIL_ROUTE,
    SETTINGS_INTEGRATIONS_ROUTE,
    SETTINGS_MCP_ROUTE,
} from '~/modules/url';

const Route = getRouteApi(SETTINGS_INTEGRATION_DETAIL_ROUTE);

export default function IntegrationDetail() {
    const { connectionId } = Route.useParams();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const confirm = useConfirm();
    const action = useIntegrationActions();
    const [trying, setTrying] = useState(false);
    const query = useQuery({
        queryKey: queryKeys.integrations.list(),
        queryFn: fetchIntegrations,
        refetchInterval: 10_000,
    });
    const integration = query.data?.find((item) => item.id === connectionId);
    const backLink = <PageBackLink to={SETTINGS_INTEGRATIONS_ROUTE}>Integrations</PageBackLink>;
    if (!integration)
        return (
            <PageLayout title="Integration" backLink={backLink}>
                {query.isPending ? (
                    <Text as="p">Loading integration…</Text>
                ) : query.isError ? (
                    <div role="alert">
                        <Text as="p">Could not load this integration.</Text>
                        <Button variant="subtle" onClick={() => query.refetch()}>
                            Retry
                        </Button>
                    </div>
                ) : (
                    <Text as="p">This integration was disconnected or does not exist.</Text>
                )}
            </PageLayout>
        );
    const section = integration.native && search.section === 'advanced' ? undefined : search.section;
    const status = getIntegrationStatus(integration);
    const needsSetup = ['address', 'setup', 'permissions'].includes(status.kind);
    const isSetup = search.setup;
    const canOpen = integration.enabled && integration.manifest.launch && !needsSetup;
    const canRead = integration.grantedPermissions.includes('notes:read');
    const finishSetup = () => {
        void navigate({ search: {}, replace: true });
    };

    return (
        <section aria-label={integration.manifest.name}>
            <PageLayout
                title={isSetup ? `Connect ${integration.manifest.name}` : integration.manifest.name}
                backLink={backLink}
                headerRight={
                    !isSetup && canOpen ? (
                        <Button asChild className="self-start">
                            <Link to={INTEGRATION_ROUTE} params={{ connectionId }}>
                                Open app
                            </Link>
                        </Button>
                    ) : undefined
                }
            >
                {query.isError && (
                    <div role="alert" className="mb-4 flex flex-wrap items-center gap-3">
                        <Text as="p" variant="meta" tone="error">
                            Could not refresh. Status may be out of date.
                        </Text>
                        <Button variant="subtle" size="sm" onClick={() => query.refetch()}>
                            Retry
                        </Button>
                    </div>
                )}
                {isSetup ? (
                    <IntegrationSetup key={connectionId} integration={integration} onConnected={finishSetup} />
                ) : (
                    <>
                        <nav aria-label="Connection settings" className="mb-5 flex gap-4 border-b border-border-subtle">
                            {(
                                [
                                    { label: 'Overview', value: undefined },
                                    { label: 'Access', value: 'access' },
                                    ...(!integration.native ? [{ label: 'Advanced', value: 'advanced' } as const] : []),
                                ] as const
                            ).map((tab) => (
                                <Link
                                    key={tab.label}
                                    to={SETTINGS_INTEGRATION_DETAIL_ROUTE}
                                    params={{ connectionId }}
                                    search={tab.value ? { section: tab.value } : {}}
                                    activeOptions={{ exact: true }}
                                    aria-current={section === tab.value ? 'page' : undefined}
                                    className={`focus-ring-soft border-b-2 px-1 py-2 text-sm ${section === tab.value ? 'border-border-secondary text-fg-default' : 'border-transparent text-fg-secondary hover:text-fg-default'}`}
                                >
                                    {tab.label}
                                </Link>
                            ))}
                        </nav>
                        <div className="space-y-5">
                            {!section && (
                                <>
                                    {needsSetup && (
                                        <Button asChild>
                                            <Link
                                                to={SETTINGS_INTEGRATION_DETAIL_ROUTE}
                                                params={{ connectionId }}
                                                search={{ setup: true }}
                                            >
                                                Continue connection
                                            </Link>
                                        </Button>
                                    )}
                                    <IntegrationActivity
                                        integration={integration}
                                        refreshing={query.isFetching}
                                        onRefresh={() => {
                                            void query.refetch();
                                        }}
                                    />
                                    <div className="surface-base divide-y divide-border-subtle px-4">
                                        <div className="flex items-center justify-between gap-4 py-3.5">
                                            <Label htmlFor="connection-enabled">Connection</Label>
                                            <div className="flex items-center gap-3">
                                                <Text as="span" variant="meta" tone="secondary">
                                                    {integration.enabled ? 'On' : 'Off'}
                                                </Text>
                                                <Switch
                                                    id="connection-enabled"
                                                    aria-label={`Enable ${integration.manifest.name}`}
                                                    checked={integration.enabled}
                                                    disabled={action.pending || (!integration.enabled && needsSetup)}
                                                    onCheckedChange={(enabled) =>
                                                        action.run(() =>
                                                            updateIntegration({ id: connectionId, enabled }),
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>
                                        {integration.manifest.launch && (
                                            <div className="flex items-center justify-between gap-4 py-3.5">
                                                <Label htmlFor="connection-pinned">Show in top bar</Label>
                                                <Switch
                                                    id="connection-pinned"
                                                    checked={integration.pinned}
                                                    disabled={action.pending}
                                                    onCheckedChange={(pinned) =>
                                                        action.run(() =>
                                                            updateIntegration({ id: connectionId, pinned }),
                                                        )
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                    {integration.native && (
                                        <div className="flex flex-wrap gap-2">
                                            <Button asChild variant="subtle">
                                                <Link to={SETTINGS_MCP_ROUTE}>Client setup</Link>
                                            </Button>
                                            {integration.enabled && canRead && (
                                                <Button variant="subtle" onClick={() => setTrying(true)}>
                                                    Try with your notes
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                            {section === 'access' &&
                                (integration.manifest.permissions.length > 0 ? (
                                    <>
                                        <div className="surface-base px-4 py-3.5">
                                            <IntegrationAccess
                                                key={JSON.stringify([
                                                    integration.manifest.permissions,
                                                    integration.grantedPermissions,
                                                ])}
                                                integration={integration}
                                            />
                                        </div>
                                        {integration.native ? (
                                            <Button asChild variant="subtle">
                                                <Link to={SETTINGS_MCP_ROUTE}>Manage MCP token</Link>
                                            </Button>
                                        ) : (
                                            <div className="surface-base px-4 py-3.5">
                                                <IntegrationToken key={connectionId} integration={integration} />
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <Text as="p" variant="meta" tone="secondary">
                                        This app does not request access to your notes.
                                    </Text>
                                ))}
                            {section === 'advanced' && (
                                <>
                                    <div className="surface-base px-4 py-3.5">
                                        <IntegrationManifestEditor
                                            key={connectionId}
                                            connectionId={connectionId}
                                            manifest={integration.manifest}
                                            proxyConfigured={integration.proxyConfigured}
                                            disabled={action.pending}
                                            onSave={(input) =>
                                                action.run(() => updateIntegration({ id: connectionId, ...input }))
                                            }
                                        />
                                    </div>
                                    <SurfaceCard>
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="space-y-1">
                                                <Text as="h2" variant="subheading" weight="medium">
                                                    Remove connection
                                                </Text>
                                                <Text as="p" variant="meta" tone="secondary">
                                                    Revokes this app’s access. Your notes are kept.
                                                </Text>
                                            </div>
                                            <Button
                                                variant="soft-danger"
                                                disabled={action.pending}
                                                onClick={async () => {
                                                    if (
                                                        !(await confirm(
                                                            `Disconnect ${integration.manifest.name}? Its token will be revoked. Notes will remain in Ocean Brain.`,
                                                        ))
                                                    )
                                                        return;
                                                    action.run(
                                                        () => disconnectIntegration(connectionId),
                                                        () => {
                                                            void navigate({
                                                                to: SETTINGS_INTEGRATIONS_ROUTE,
                                                                replace: true,
                                                            });
                                                        },
                                                    );
                                                }}
                                            >
                                                <Icon.TrashCan aria-hidden="true" className="h-4 w-4" />
                                                Disconnect app
                                            </Button>
                                        </div>
                                    </SurfaceCard>
                                </>
                            )}
                            {action.error && (
                                <Text as="p" role="alert" variant="meta" tone="error">
                                    {getIntegrationErrorMessage(action.error)}
                                </Text>
                            )}
                        </div>
                    </>
                )}
            </PageLayout>
            <Dialog open={trying} onOpenChange={setTrying}>
                <DialogContent variant="form">
                    <DialogHeader title="Try with your notes" onClose={() => setTrying(false)} />
                    <DialogBody>
                        <IntegrationFirstTask canCreate={integration.grantedPermissions.includes('notes:create')} />
                    </DialogBody>
                </DialogContent>
            </Dialog>
        </section>
    );
}
