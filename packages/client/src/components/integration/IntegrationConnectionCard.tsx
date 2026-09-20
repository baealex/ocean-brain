import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useId, useState } from 'react';
import {
    disconnectIntegration,
    getIntegrationErrorMessage,
    type IntegrationConnection,
    revokeIntegrationToken,
    rotateIntegrationToken,
    updateIntegration,
} from '~/apis/integration.api';
import * as Icon from '~/components/icon';
import { Button, Input, Label, Switch, Text, useConfirm, useToast } from '~/components/ui';
import { getIntegrationStatus } from '~/modules/integration-status';
import { queryKeys } from '~/modules/query-key-factory';
import { INTEGRATION_ROUTE, SETTINGS_MCP_ROUTE } from '~/modules/url';
import IntegrationFirstTask from './IntegrationFirstTask';
import IntegrationManifestEditor from './IntegrationManifestEditor';
import IntegrationPermissions from './IntegrationPermissions';

export default function IntegrationConnectionCard({
    integration,
    expanded,
    onExpandedChange,
}: {
    integration: IntegrationConnection;
    expanded: boolean;
    onExpandedChange: () => void;
}) {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const toast = useToast();
    const panelId = useId();
    const [token, setToken] = useState('');
    const invalidate = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all(), exact: false }),
            queryClient.invalidateQueries({ queryKey: queryKeys.mcp.status(), exact: true }),
        ]);
    };
    const action = useMutation({ mutationFn: async (run: () => Promise<unknown>) => run(), onSuccess: invalidate });
    const run = (operation: () => Promise<unknown>) => action.mutate(operation);
    const launch = integration.manifest.launch;
    const status = getIntegrationStatus(integration);
    const canRead = integration.grantedPermissions.includes('notes:read');
    const needsSetup = ['address', 'setup', 'permissions', 'paused'].includes(status.kind);
    const canOpenApp =
        launch && integration.enabled && !needsSetup && (launch.mode !== 'proxied' || integration.proxyConfigured);
    const canTryMcp = integration.native && integration.enabled && integration.token && canRead;
    const needsAttention = status.kind === 'failed' || status.kind === 'overdue';
    const StatusIcon = needsAttention ? Icon.WarningCircle : status.kind === 'running' ? Icon.Clock : Icon.Info;
    const openSettings = () => {
        if (!expanded) onExpandedChange();
    };
    return (
        <section aria-label={integration.manifest.name} className="surface-base min-w-0">
            <div className="flex items-start gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-fg-secondary">
                    {integration.native ? (
                        <Icon.Code aria-hidden="true" className="h-5 w-5" />
                    ) : (
                        <Icon.LinkIcon aria-hidden="true" className="h-5 w-5" />
                    )}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                    <Text as="h3" weight="medium" className="break-words">
                        {integration.manifest.name}
                    </Text>
                    <Text as="p" variant="meta" tone="secondary" className={expanded ? 'break-words' : 'line-clamp-1'}>
                        {integration.manifest.description}
                    </Text>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Configure ${integration.manifest.name}`}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={onExpandedChange}
                    className="min-h-11 min-w-11 shrink-0"
                >
                    <Icon.Gear aria-hidden="true" className="h-4 w-4" />
                </Button>
            </div>
            <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
                <div className="flex flex-col gap-4 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-2.5">
                        <StatusIcon
                            aria-hidden="true"
                            className={`mt-0.5 h-4 w-4 shrink-0 ${needsAttention ? 'text-fg-error' : 'text-fg-secondary'}`}
                        />
                        <div className="min-w-0 space-y-1">
                            <Text as="p" variant="meta" weight="medium" tone={needsAttention ? 'error' : 'default'}>
                                {status.label}
                            </Text>
                            {status.detail && (
                                <Text as="p" variant="meta" tone="secondary" className="break-words">
                                    {status.detail}
                                </Text>
                            )}
                            {integration.statusReport ? (
                                <Text as="p" variant="micro" tone="tertiary">
                                    Reported by app · {new Date(integration.statusReport.reportedAt).toLocaleString()}
                                </Text>
                            ) : integration.token?.lastUsedAt ? (
                                <Text as="p" variant="micro" tone="tertiary">
                                    Last connection · {new Date(integration.token.lastUsedAt).toLocaleString()}
                                </Text>
                            ) : null}
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 sm:pl-3">
                        {canOpenApp ? (
                            <Button asChild variant="subtle" className="min-h-11 w-full sm:w-auto">
                                <Link to={INTEGRATION_ROUTE} params={{ connectionId: integration.id }}>
                                    Open app <Icon.ArrowRight aria-hidden="true" className="h-4 w-4" />
                                </Link>
                            </Button>
                        ) : integration.native && status.kind !== 'permissions' && !canTryMcp ? (
                            <Button asChild variant="subtle" className="min-h-11 w-full sm:w-auto">
                                <Link to={SETTINGS_MCP_ROUTE}>
                                    Set up MCP <Icon.ArrowRight aria-hidden="true" className="h-4 w-4" />
                                </Link>
                            </Button>
                        ) : !expanded ? (
                            <Button variant="subtle" onClick={openSettings} className="min-h-11 w-full sm:w-auto">
                                {canTryMcp ? 'Try with your notes' : needsSetup ? 'Continue setup' : 'View settings'}
                                <Icon.ArrowRight aria-hidden="true" className="h-4 w-4" />
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>
            <div id={panelId} hidden={!expanded} className="border-t border-border-subtle px-4 py-5 sm:px-5">
                {integration.native && integration.enabled && integration.token && canRead && (
                    <IntegrationFirstTask canCreate={integration.grantedPermissions.includes('notes:create')} />
                )}
                <div className="mb-5 flex items-center justify-between gap-4 border-b border-border-subtle pb-4">
                    <div className="space-y-1">
                        <Label htmlFor={`access-${integration.id}`}>Integration access</Label>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                        <Text as="span" variant="meta" weight="medium">
                            {integration.enabled ? 'On' : 'Off'}
                        </Text>
                        <Switch
                            id={`access-${integration.id}`}
                            aria-label={`Enable ${integration.manifest.name}`}
                            checked={integration.enabled}
                            disabled={
                                action.isPending ||
                                (!integration.enabled && launch?.mode === 'proxied' && !integration.proxyConfigured)
                            }
                            onCheckedChange={(enabled) => run(() => updateIntegration({ id: integration.id, enabled }))}
                        />
                    </div>
                </div>
                <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
                    <IntegrationPermissions
                        requested={integration.manifest.permissions}
                        granted={integration.grantedPermissions}
                        disabled={action.isPending}
                        onChange={(grantedPermissions) =>
                            run(() => updateIntegration({ id: integration.id, grantedPermissions }))
                        }
                    />
                    <div className="flex min-w-0 flex-col items-start gap-3">
                        <Text as="h3" variant="label" weight="medium" tone="secondary">
                            Connection details
                        </Text>
                        {integration.native && (
                            <Button asChild variant="subtle" size="sm">
                                <Link to={SETTINGS_MCP_ROUTE}>
                                    MCP connection setup <Icon.ArrowRight aria-hidden="true" className="h-4 w-4" />
                                </Link>
                            </Button>
                        )}
                        {launch && (
                            <div className="flex w-full flex-col gap-3">
                                <Text as="p" variant="meta" tone="secondary" className="break-all">
                                    {launch.mode === 'proxied'
                                        ? integration.proxyConfigured
                                            ? 'Private app address saved'
                                            : 'Private app address needed'
                                        : launch.url}
                                </Text>
                                <div className="flex flex-wrap items-center gap-3">
                                    <Switch
                                        id={`pin-${integration.id}`}
                                        checked={integration.pinned}
                                        disabled={action.isPending}
                                        onCheckedChange={(pinned) =>
                                            run(() => updateIntegration({ id: integration.id, pinned }))
                                        }
                                    />
                                    <Label htmlFor={`pin-${integration.id}`}>Show in top bar</Label>
                                </div>
                            </div>
                        )}
                        {!integration.native &&
                            integration.manifest.permissions.length > 0 &&
                            (!integration.token?.lastUsedAt || !integration.enabled) && (
                                <div className="w-full space-y-3">
                                    <ol className="list-decimal space-y-2 pl-5 text-sm text-fg-secondary">
                                        <li>Save a token in your app.</li>
                                        <li>Set the server URL below and turn access on.</li>
                                        <li>Run a task to check the connection.</li>
                                    </ol>
                                    <Label htmlFor={`server-url-${integration.id}`}>Ocean Brain URL</Label>
                                    <Input
                                        id={`server-url-${integration.id}`}
                                        readOnly
                                        value={window.location.origin}
                                    />
                                </div>
                            )}
                        <Text as="p" variant="meta" tone="secondary">
                            {integration.token
                                ? `Last API access: ${integration.token.lastUsedAt ? new Date(integration.token.lastUsedAt).toLocaleString() : 'Not used yet'}`
                                : 'No active token'}
                        </Text>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="subtle"
                                size="sm"
                                disabled={action.isPending}
                                onClick={async () => {
                                    if (
                                        integration.token &&
                                        !(await confirm(
                                            'Replace this integration token? Existing connections using it will stop working.',
                                        ))
                                    )
                                        return;
                                    run(async () => {
                                        const issued = await rotateIntegrationToken(integration.id);
                                        setToken(issued.token);
                                    });
                                }}
                            >
                                {integration.token ? 'Replace token' : 'Generate token'}
                            </Button>
                            {integration.token && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={action.isPending}
                                    onClick={async () => {
                                        if (
                                            !(await confirm(
                                                'Revoke this integration token? Its connections will lose access.',
                                            ))
                                        )
                                            return;
                                        run(async () => {
                                            await revokeIntegrationToken(integration.id);
                                            setToken('');
                                        });
                                    }}
                                >
                                    Revoke token
                                </Button>
                            )}
                        </div>
                        {token && (
                            <div className="flex w-full min-w-0 flex-col gap-2">
                                <Label htmlFor={`token-${integration.id}`}>
                                    Save this token now. It is shown only once.
                                </Label>
                                <Input
                                    id={`token-${integration.id}`}
                                    value={token}
                                    readOnly
                                    autoComplete="off"
                                    className="font-mono text-xs"
                                />
                                <div className="flex gap-2">
                                    <Button
                                        variant="subtle"
                                        size="sm"
                                        onClick={async () => {
                                            try {
                                                await navigator.clipboard.writeText(token);
                                                toast('Copied token.');
                                            } catch {
                                                toast('Could not copy. Select the token and copy it manually.');
                                            }
                                        }}
                                    >
                                        <Icon.Copy className="h-4 w-4" />
                                        Copy token
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setToken('')}>
                                        Hide token
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {!integration.native && (
                    <details className="group mt-5 border-t border-border-subtle pt-3">
                        <summary className="focus-ring-soft flex cursor-pointer list-none items-center gap-2 rounded-lg py-2 text-sm text-fg-secondary marker:hidden">
                            <Icon.ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                            App settings
                        </summary>
                        <IntegrationManifestEditor
                            connectionId={integration.id}
                            manifest={integration.manifest}
                            proxyConfigured={integration.proxyConfigured}
                            disabled={action.isPending}
                            onSave={(input) => run(() => updateIntegration({ id: integration.id, ...input }))}
                        />
                    </details>
                )}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3">
                    <Text as="p" variant="meta" tone="tertiary" className="min-w-0 break-all">
                        {integration.manifest.id} · v{integration.manifest.version}
                    </Text>
                    {!integration.native && (
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={action.isPending}
                            onClick={async () => {
                                if (
                                    !(await confirm(
                                        `Disconnect ${integration.manifest.name}? Its token will be revoked. Notes will remain in Ocean Brain.`,
                                    ))
                                )
                                    return;
                                run(() => disconnectIntegration(integration.id));
                            }}
                        >
                            Disconnect
                        </Button>
                    )}
                </div>
            </div>
            {action.error && (
                <p role="alert" className="px-4 pb-4 text-sm text-fg-error">
                    {getIntegrationErrorMessage(action.error)}
                </p>
            )}
        </section>
    );
}
