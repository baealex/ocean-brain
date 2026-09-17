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
import { Button, Input, Label, Switch, Text, Textarea, useConfirm, useToast } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';
import { INTEGRATION_ROUTE, SETTINGS_MCP_ROUTE } from '~/modules/url';
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
    const [upgrade, setUpgrade] = useState('');
    const invalidate = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all(), exact: false }),
            queryClient.invalidateQueries({ queryKey: queryKeys.mcp.status(), exact: true }),
        ]);
    };
    const action = useMutation({ mutationFn: async (run: () => Promise<unknown>) => run(), onSuccess: invalidate });
    const run = (operation: () => Promise<unknown>) => action.mutate(operation);
    const launch = integration.manifest.launch;
    return (
        <section aria-label={integration.manifest.name} className="surface-base min-w-0">
            <div className="flex items-center gap-2 p-3 sm:gap-4 sm:px-4 sm:py-3.5">
                <button
                    type="button"
                    aria-label={`Configure ${integration.manifest.name}`}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={onExpandedChange}
                    className="focus-ring-soft group flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
                >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] border border-border-subtle bg-muted text-fg-secondary group-hover:text-fg-default">
                        {integration.native ? <Icon.Code className="h-6 w-6" /> : <Icon.LinkIcon className="h-6 w-6" />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <Text as="span" weight="medium" className="break-words">
                            {integration.manifest.name}
                        </Text>
                        <Text as="span" variant="meta" tone="secondary" className="line-clamp-2 break-words">
                            {integration.manifest.description}
                        </Text>
                    </span>
                    <Icon.ChevronDown
                        aria-hidden="true"
                        className={`h-4 w-4 shrink-0 text-fg-tertiary transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                </button>
                <div className="flex shrink-0 items-center gap-2 border-l border-border-subtle pl-3 sm:gap-3 sm:pl-4">
                    <Text as="span" variant="meta" tone="secondary" className="hidden sm:inline">
                        {integration.enabled ? 'On' : 'Off'}
                    </Text>
                    <Switch
                        aria-label={`Enable ${integration.manifest.name}`}
                        checked={integration.enabled}
                        disabled={action.isPending}
                        onCheckedChange={(enabled) => run(() => updateIntegration({ id: integration.id, enabled }))}
                    />
                </div>
            </div>
            <div id={panelId} hidden={!expanded} className="border-t border-border-subtle px-4 py-5 sm:px-5">
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
                            Connection
                        </Text>
                        {launch && (
                            <div className="flex w-full flex-col gap-3">
                                <Text as="p" variant="meta" tone="secondary" className="break-all">
                                    {launch.url}
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
                                    {integration.enabled && (
                                        <Button asChild variant="ghost" size="sm">
                                            <Link to={INTEGRATION_ROUTE} params={{ connectionId: integration.id }}>
                                                Open app
                                                <Icon.ArrowRight className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                        {integration.native && (
                            <Button asChild variant="subtle" size="sm">
                                <Link to={SETTINGS_MCP_ROUTE}>
                                    MCP connection setup
                                    <Icon.ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
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
                            Update app manifest
                        </summary>
                        <div className="mt-3 flex flex-col gap-2">
                            <Textarea
                                aria-label={`Updated manifest for ${integration.manifest.name}`}
                                value={upgrade}
                                onChange={(event) => setUpgrade(event.target.value)}
                                rows={6}
                                className="font-mono text-xs"
                                disabled={action.isPending}
                            />
                            <Text as="p" variant="meta" tone="secondary">
                                New permissions stay unapproved until you enable them above.
                            </Text>
                            <Button
                                variant="subtle"
                                size="sm"
                                className="self-start"
                                disabled={action.isPending || !upgrade.trim()}
                                onClick={() =>
                                    run(async () => {
                                        await updateIntegration({ id: integration.id, manifest: JSON.parse(upgrade) });
                                        setUpgrade('');
                                    })
                                }
                            >
                                Update manifest
                            </Button>
                        </div>
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
