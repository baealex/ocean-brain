import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
    connectIntegration,
    getIntegrationErrorMessage,
    INTEGRATION_PERMISSIONS,
    type IntegrationPermission,
} from '~/apis/integration.api';
import * as Icon from '~/components/icon';
import IntegrationPermissions from '~/components/integration/IntegrationPermissions';
import { PageLayout } from '~/components/shared';
import PageBackLink from '~/components/shared/PageBackLink';
import { Button, Input, Label, Text, Textarea } from '~/components/ui';
import { queryKeys } from '~/modules/query-key-factory';
import { SETTINGS_INTEGRATION_DETAIL_ROUTE, SETTINGS_INTEGRATIONS_ROUTE, SETTINGS_MCP_ROUTE } from '~/modules/url';

const previewManifest = (
    text: string,
): { name: string; permissions: IntegrationPermission[]; proxied: boolean } | null => {
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
        const launch =
            'launch' in value && typeof value.launch === 'object' && value.launch !== null ? value.launch : null;
        return {
            name: value.name,
            permissions: [...new Set(permissions)],
            proxied: Boolean(launch && 'mode' in launch && launch.mode === 'proxied'),
        };
    } catch {
        return null;
    }
};

export default function IntegrationConnect() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [step, setStep] = useState<'choose' | 'file' | 'access'>('choose');
    const [paste, setPaste] = useState(false);
    const [manifestText, setManifestText] = useState('');
    const [fileName, setFileName] = useState('');
    const [fileError, setFileError] = useState('');
    const [proxyUrl, setProxyUrl] = useState('');
    const [grants, setGrants] = useState<IntegrationPermission[]>([]);
    const preview = previewManifest(manifestText);
    const connect = useMutation({
        mutationFn: () =>
            connectIntegration({
                manifest: JSON.parse(manifestText),
                grantedPermissions: grants,
                ...(preview?.proxied ? { proxyUrl: proxyUrl.trim() } : {}),
            }),
        onSuccess: async (connection) => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all(), exact: false });
            await navigate({
                to: SETTINGS_INTEGRATION_DETAIL_ROUTE,
                params: { connectionId: connection.id },
                search: { setup: true },
                replace: true,
            });
        },
    });
    const resetManifest = (text: string) => {
        setManifestText(text);
        setGrants([]);
        setProxyUrl('');
        setFileError('');
        connect.reset();
    };
    const choiceClassName =
        'focus-ring-soft surface-base flex items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-hover-subtle';

    return (
        <PageLayout
            title={step === 'access' && preview ? `Connect ${preview.name}` : 'Connect app'}
            backLink={<PageBackLink to={SETTINGS_INTEGRATIONS_ROUTE}>Integrations</PageBackLink>}
        >
            {step === 'choose' ? (
                <div className="grid gap-3 md:grid-cols-2">
                    <Link to={SETTINGS_MCP_ROUTE} className={choiceClassName}>
                        <Icon.Code aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-fg-secondary" />
                        <div className="min-w-0 space-y-1">
                            <Text as="h2" weight="medium">
                                AI client
                            </Text>
                            <Text as="p" variant="meta" tone="secondary">
                                Use your notes through MCP.
                            </Text>
                        </div>
                        <Icon.ChevronRight aria-hidden="true" className="ml-auto h-4 w-4 shrink-0 text-fg-tertiary" />
                    </Link>
                    <button type="button" className={choiceClassName} onClick={() => setStep('file')}>
                        <Icon.LinkIcon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-fg-secondary" />
                        <div className="min-w-0 space-y-1">
                            <Text as="h2" weight="medium">
                                External app
                            </Text>
                            <Text as="p" variant="meta" tone="secondary">
                                Connect using a file supplied by the app.
                            </Text>
                        </div>
                        <Icon.ChevronRight aria-hidden="true" className="ml-auto h-4 w-4 shrink-0 text-fg-tertiary" />
                    </button>
                </div>
            ) : (
                <div className="space-y-5">
                    {step === 'file' ? (
                        <>
                            <Text as="p" variant="meta" tone="secondary">
                                Choose the connection file supplied by your app.
                            </Text>
                            {paste ? (
                                <div className="space-y-2">
                                    <Label htmlFor="integration-manifest">App manifest JSON</Label>
                                    <Textarea
                                        id="integration-manifest"
                                        rows={8}
                                        className="font-mono text-xs"
                                        value={manifestText}
                                        onChange={(event) => {
                                            setFileName('');
                                            resetManifest(event.target.value);
                                        }}
                                    />
                                </div>
                            ) : (
                                <Input
                                    aria-label="App manifest file"
                                    type="file"
                                    accept="application/json,.json"
                                    className="h-auto py-3"
                                    onChange={async (event) => {
                                        const file = event.target.files?.[0];
                                        if (!file) return;
                                        resetManifest('');
                                        setFileName(file.name);
                                        if (file.size > 65536) {
                                            setFileError('Choose a file smaller than 64 KB.');
                                            return;
                                        }
                                        try {
                                            resetManifest(await file.text());
                                        } catch {
                                            setFileError('Could not read this file. Choose it again.');
                                        }
                                    }}
                                />
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setPaste(!paste)}>
                                {paste ? 'Choose a file instead' : 'Paste manifest JSON'}
                            </Button>
                            {fileName && (
                                <Text as="p" variant="meta" tone="secondary">
                                    {fileName}
                                </Text>
                            )}
                            {preview && (
                                <Text as="p" weight="medium">
                                    {preview.name}
                                </Text>
                            )}
                            {manifestText && !preview && (
                                <Text as="p" variant="meta" tone="error" role="alert">
                                    Choose a valid app connection file.
                                </Text>
                            )}
                            {fileError && (
                                <Text as="p" variant="meta" tone="error" role="alert">
                                    {fileError}
                                </Text>
                            )}
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => setStep('choose')}>
                                    Back
                                </Button>
                                <Button disabled={!preview} onClick={() => setStep('access')}>
                                    Continue
                                </Button>
                            </div>
                        </>
                    ) : (
                        preview && (
                            <>
                                {preview.permissions.length > 0 ? (
                                    <IntegrationPermissions
                                        requested={preview.permissions}
                                        granted={grants}
                                        onChange={setGrants}
                                        disabled={connect.isPending}
                                    />
                                ) : (
                                    <Text as="p" variant="meta" tone="secondary">
                                        This app does not request access to your notes.
                                    </Text>
                                )}
                                {preview.proxied && (
                                    <div className="space-y-2">
                                        <Label htmlFor="new-integration-address">App address</Label>
                                        <Input
                                            id="new-integration-address"
                                            aria-label="Private app URL"
                                            type="url"
                                            placeholder="http://127.0.0.1:7778"
                                            value={proxyUrl}
                                            disabled={connect.isPending}
                                            onChange={(event) => setProxyUrl(event.target.value)}
                                        />
                                        <Text as="p" variant="meta" tone="secondary">
                                            The app must be running at this address.
                                        </Text>
                                    </div>
                                )}
                                {connect.error && (
                                    <Text as="p" role="alert" variant="meta" tone="error">
                                        {getIntegrationErrorMessage(connect.error)}
                                    </Text>
                                )}
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        disabled={connect.isPending}
                                        onClick={() => setStep('file')}
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        disabled={preview.proxied && !proxyUrl.trim()}
                                        isLoading={connect.isPending}
                                        onClick={() => connect.mutate()}
                                    >
                                        Connect app
                                    </Button>
                                </div>
                            </>
                        )
                    )}
                </div>
            )}
        </PageLayout>
    );
}
