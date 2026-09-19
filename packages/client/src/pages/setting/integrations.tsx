import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import classNames from 'classnames';
import { useState } from 'react';
import {
    connectIntegration,
    fetchIntegrations,
    getIntegrationErrorMessage,
    INTEGRATION_PERMISSIONS,
    type IntegrationPermission,
} from '~/apis/integration.api';
import * as Icon from '~/components/icon';
import IntegrationConnectionCard from '~/components/integration/IntegrationConnectionCard';
import IntegrationPermissions from '~/components/integration/IntegrationPermissions';
import { PageLayout } from '~/components/shared';
import {
    Button,
    buttonVariants,
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTrigger,
    Text,
    Textarea,
} from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';
import { SETTINGS_INTEGRATIONS_ROUTE } from '~/modules/url';

const Route = getRouteApi(SETTINGS_INTEGRATIONS_ROUTE);

const previewManifest = (text: string): { name: string; permissions: IntegrationPermission[] } | null => {
    try {
        const value: unknown = JSON.parse(text);
        if (
            typeof value !== 'object' ||
            value === null ||
            !('name' in value) ||
            typeof value.name !== 'string' ||
            !('permissions' in value) ||
            !Array.isArray(value.permissions)
        )
            return null;
        const permissions = value.permissions.filter((permission): permission is IntegrationPermission =>
            INTEGRATION_PERMISSIONS.some((supported) => permission === supported),
        );
        if (permissions.length !== value.permissions.length) return null;
        return { name: value.name, permissions: [...new Set(permissions)] };
    } catch {
        return null;
    }
};

export default function IntegrationsSettings() {
    const queryClient = useQueryClient();
    const navigate = Route.useNavigate();
    const { connection: expandedId } = Route.useSearch();
    const setExpandedId = (connection?: string) =>
        navigate({ search: { connection }, replace: true, resetScroll: false });
    const [isAdding, setIsAdding] = useState(false);
    const [fileName, setFileName] = useState('');
    const [manifestText, setManifestText] = useState('');
    const [grantedPermissions, setGrants] = useState<IntegrationPermission[]>([]);
    const [fileError, setFileError] = useState('');
    const integrations = useQuery({ queryKey: queryKeys.integrations.list(), queryFn: fetchIntegrations });
    const connect = useMutation({
        mutationFn: () => connectIntegration({ manifest: JSON.parse(manifestText), grantedPermissions }),
        onSuccess: async (integration) => {
            setManifestText('');
            setGrants([]);
            setFileName('');
            setIsAdding(false);
            setExpandedId(integration.id);
            await queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all(), exact: false });
        },
    });
    const preview = previewManifest(manifestText);
    const groups = [
        {
            title: 'Built-in integrations',
            integrations: integrations.data?.filter((integration) => integration.native) ?? [],
        },
        { title: 'External apps', integrations: integrations.data?.filter((integration) => !integration.native) ?? [] },
    ];
    const closeDialog = () => {
        if (!connect.isPending) setIsAdding(false);
    };
    return (
        <Dialog open={isAdding} onOpenChange={(open) => !connect.isPending && setIsAdding(open)}>
            <PageLayout
                title="Integrations"
                description="Manage MCP and external apps connected to your notes."
                headerRight={
                    <DialogTrigger asChild>
                        <Button>
                            <Icon.Plus className="h-4 w-4" />
                            Connect app
                        </Button>
                    </DialogTrigger>
                }
            >
                <div className="flex flex-col gap-6">
                    {integrations.isPending && <Text as="p">Loading integrations…</Text>}
                    {integrations.error && (
                        <div role="alert">
                            <Text as="p">Could not load integrations.</Text>
                            <Button variant="subtle" onClick={() => integrations.refetch()}>
                                Retry
                            </Button>
                        </div>
                    )}
                    {integrations.data &&
                        groups.map((group) => (
                            <section key={group.title} aria-label={group.title} className="flex flex-col gap-3">
                                <Text as="h2" variant="label" weight="medium" tone="tertiary">
                                    {group.title}
                                </Text>
                                {group.integrations.map((integration) => (
                                    <IntegrationConnectionCard
                                        key={integration.id}
                                        integration={integration}
                                        expanded={expandedId === integration.id}
                                        onExpandedChange={() =>
                                            setExpandedId(expandedId === integration.id ? undefined : integration.id)
                                        }
                                    />
                                ))}
                                {group.integrations.length === 0 && (
                                    <Text as="p" variant="meta" tone="secondary" className="py-3">
                                        {group.title === 'External apps'
                                            ? 'No external apps connected.'
                                            : 'No built-in integrations available.'}
                                    </Text>
                                )}
                            </section>
                        ))}
                </div>
            </PageLayout>
            <DialogContent variant="form">
                <DialogHeader title="Connect an external app" onClose={closeDialog} />
                <DialogBody className="space-y-5">
                    <DialogDescription>
                        Connect an app running on its own service using its manifest file.
                    </DialogDescription>
                    <div className="flex items-center gap-3">
                        <label
                            className={classNames(
                                buttonVariants({ variant: 'subtle' }),
                                'relative cursor-pointer focus-within:border-border-focus focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent-soft-primary)_90%,transparent)]',
                                connect.isPending && 'pointer-events-none opacity-50',
                            )}
                        >
                            <Icon.Upload className="h-4 w-4" />
                            Choose file
                            <input
                                aria-label="App manifest file"
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 outline-none"
                                type="file"
                                accept="application/json,.json"
                                disabled={connect.isPending}
                                onClick={(event) => {
                                    event.currentTarget.value = '';
                                }}
                                onChange={async (event) => {
                                    const file = event.target.files?.[0];
                                    if (!file) return;
                                    setManifestText('');
                                    setGrants([]);
                                    setFileName(file.name);
                                    connect.reset();
                                    if (file.size > 65536) {
                                        setFileError('Choose a manifest smaller than 64 KB.');
                                        return;
                                    }
                                    setFileError('');
                                    try {
                                        setManifestText(await file.text());
                                    } catch {
                                        setFileError('Could not read this file. Choose it again.');
                                    }
                                }}
                            />
                        </label>
                        <Text as="span" variant="meta" tone="secondary" className="min-w-0 truncate">
                            {fileName || 'JSON manifest · up to 64 KB'}
                        </Text>
                    </div>
                    <details className="group">
                        <summary className="focus-ring-soft flex cursor-pointer list-none items-center gap-2 rounded-lg py-2 text-sm text-fg-secondary marker:hidden">
                            <Icon.ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                            Paste manifest JSON
                        </summary>
                        <Textarea
                            aria-label="App manifest JSON"
                            rows={8}
                            className="mt-2 font-mono text-xs"
                            value={manifestText}
                            disabled={connect.isPending}
                            onChange={(event) => {
                                setManifestText(event.target.value);
                                setGrants([]);
                                setFileName('');
                                setFileError('');
                                connect.reset();
                            }}
                        />
                    </details>
                    {preview && (
                        <div className="space-y-4 border-t border-border-subtle pt-4">
                            <Text as="p" weight="medium">
                                {preview.name}
                            </Text>
                            <IntegrationPermissions
                                requested={preview.permissions}
                                granted={grantedPermissions}
                                onChange={setGrants}
                                disabled={connect.isPending}
                            />
                            <Text as="p" variant="meta" tone="secondary">
                                Starts disabled. Generate a token and configure it in the external app before enabling
                                access.
                            </Text>
                        </div>
                    )}
                    {manifestText && !preview && (
                        <Text as="p" role="alert" variant="meta" tone="error">
                            The manifest must include a name and supported permissions.
                        </Text>
                    )}
                    {fileError && (
                        <Text as="p" role="alert" variant="meta" tone="error">
                            {fileError}
                        </Text>
                    )}
                    {connect.error && (
                        <Text as="p" role="alert" variant="meta" tone="error">
                            {getIntegrationErrorMessage(connect.error)}
                        </Text>
                    )}
                </DialogBody>
                <DialogFooter className="gap-2">
                    <Button variant="ghost" disabled={connect.isPending} onClick={closeDialog}>
                        Cancel
                    </Button>
                    <Button disabled={!preview} isLoading={connect.isPending} onClick={() => connect.mutate()}>
                        Connect app
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
