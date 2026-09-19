import { useEffect, useId, useState } from 'react';
import type { IntegrationManifest } from '~/apis/integration.api';
import * as Icon from '~/components/icon';
import { Button, Input, Label, Select, SelectItem, Text, Textarea } from '~/components/ui';

type LaunchMode = 'none' | 'proxied' | 'iframe' | 'external';

const launchModes = new Set<LaunchMode>(['proxied', 'iframe', 'external']);

const formatManifest = (manifest: unknown) => JSON.stringify(manifest, null, 2);

const parseManifestObject = (text: string): Record<string, unknown> | null => {
    try {
        const value: unknown = JSON.parse(text);
        return typeof value === 'object' && value !== null && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
};

const getLaunch = (manifest: Record<string, unknown> | null) => {
    const launch = manifest?.launch;
    return typeof launch === 'object' && launch !== null && !Array.isArray(launch)
        ? (launch as Record<string, unknown>)
        : null;
};

const getLaunchMode = (manifest: Record<string, unknown> | null): LaunchMode => {
    const mode = getLaunch(manifest)?.mode;
    return typeof mode === 'string' && launchModes.has(mode as LaunchMode) ? (mode as LaunchMode) : 'none';
};

const getText = (manifest: Record<string, unknown> | null, field: string) => {
    const value = manifest?.[field];
    return typeof value === 'string' ? value : '';
};

const modeDescription: Record<LaunchMode, string> = {
    proxied: 'Ocean Brain requests the private app URL and serves it from the connection’s /apps path.',
    iframe: 'Ocean Brain embeds this URL. The user’s browser must be able to reach it.',
    external: 'Ocean Brain opens this URL outside the app.',
    none: 'This integration provides API access without an app page.',
};

export default function IntegrationManifestEditor({
    connectionId,
    manifest,
    proxyConfigured,
    disabled,
    onSave,
}: {
    connectionId: string;
    manifest: IntegrationManifest;
    proxyConfigured: boolean;
    disabled?: boolean;
    onSave: (input: { manifest: unknown; proxyUrl?: string }) => void;
}) {
    const fieldId = useId();
    const savedText = formatManifest(manifest);
    const [draftText, setDraftText] = useState(savedText);
    const [proxyUrl, setProxyUrl] = useState('');

    useEffect(() => {
        setDraftText(savedText);
        setProxyUrl('');
    }, [savedText]);

    const draft = parseManifestObject(draftText);
    const launch = getLaunch(draft);
    const launchMode = getLaunchMode(draft);
    const launchUrl = typeof launch?.url === 'string' ? launch.url : '';
    const changed = Boolean(draft && (JSON.stringify(draft) !== JSON.stringify(manifest) || proxyUrl.trim()));
    const dirty = draftText !== savedText || Boolean(proxyUrl);
    const launchUrlMissing = (launchMode === 'iframe' || launchMode === 'external') && !launchUrl.trim();
    const proxyUrlMissing = launchMode === 'proxied' && !proxyConfigured && !proxyUrl.trim();

    const updateDraft = (update: (current: Record<string, unknown>) => Record<string, unknown>) => {
        if (!draft) return;
        setDraftText(formatManifest(update(draft)));
    };
    const updateText = (field: string, value: string) => updateDraft((current) => ({ ...current, [field]: value }));
    const updateLaunchMode = (mode: LaunchMode) => {
        if (mode !== 'proxied') setProxyUrl('');
        updateDraft((current) => {
            if (mode === 'none') {
                const { launch: _launch, ...withoutLaunch } = current;
                return withoutLaunch;
            }
            if (mode === 'proxied') return { ...current, launch: { mode } };
            return { ...current, launch: { mode, url: launchUrl } };
        });
    };

    return (
        <div className="mt-3 flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor={`${fieldId}-name`}>App name</Label>
                    <Input
                        id={`${fieldId}-name`}
                        value={getText(draft, 'name')}
                        maxLength={80}
                        disabled={disabled || !draft}
                        onChange={(event) => updateText('name', event.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor={`${fieldId}-description`}>Description</Label>
                    <Textarea
                        id={`${fieldId}-description`}
                        value={getText(draft, 'description')}
                        maxLength={500}
                        rows={3}
                        disabled={disabled || !draft}
                        onChange={(event) => updateText('description', event.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor={`${fieldId}-version`}>Version</Label>
                    <Input
                        id={`${fieldId}-version`}
                        value={getText(draft, 'version')}
                        maxLength={40}
                        disabled={disabled || !draft}
                        onChange={(event) => updateText('version', event.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor={`${fieldId}-launch`}>App page</Label>
                    <Select
                        id={`${fieldId}-launch`}
                        value={launchMode}
                        disabled={disabled || !draft}
                        onValueChange={(value) => updateLaunchMode(value as LaunchMode)}
                    >
                        <SelectItem value="proxied">Proxied through Ocean Brain</SelectItem>
                        <SelectItem value="iframe">Embedded iframe</SelectItem>
                        <SelectItem value="external">External link</SelectItem>
                        <SelectItem value="none">No app page</SelectItem>
                    </Select>
                </div>
                {(launchMode === 'iframe' || launchMode === 'external') && (
                    <div className="flex flex-col gap-2 sm:col-span-2">
                        <Label htmlFor={`${fieldId}-url`}>App URL</Label>
                        <Input
                            id={`${fieldId}-url`}
                            type="url"
                            value={launchUrl}
                            placeholder="https://app.example.com"
                            disabled={disabled || !draft}
                            onChange={(event) =>
                                updateDraft((current) => ({
                                    ...current,
                                    launch: { mode: launchMode, url: event.target.value },
                                }))
                            }
                        />
                    </div>
                )}
                {launchMode === 'proxied' && (
                    <div className="flex flex-col gap-2 sm:col-span-2">
                        <Label htmlFor={`${fieldId}-proxy-url`}>Private app URL</Label>
                        <Input
                            id={`${fieldId}-proxy-url`}
                            type="url"
                            value={proxyUrl}
                            placeholder={
                                proxyConfigured ? 'Configured — enter a URL to replace it' : 'http://127.0.0.1:7778'
                            }
                            disabled={disabled || !draft}
                            onChange={(event) => setProxyUrl(event.target.value)}
                        />
                        <Text as="p" variant="meta" tone="secondary">
                            Stored only on the Ocean Brain server and never included in the manifest or API response.
                        </Text>
                    </div>
                )}
            </div>
            <Text as="p" variant="meta" tone="secondary">
                {launchMode === 'proxied'
                    ? `${modeDescription.proxied} Public path: /apps/${connectionId}/`
                    : modeDescription[launchMode]}
            </Text>
            <details className="group rounded-[14px] border border-border-subtle px-3 py-2">
                <summary className="focus-ring-soft flex cursor-pointer list-none items-center gap-2 rounded-lg py-1 text-sm text-fg-secondary marker:hidden">
                    <Icon.ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                    Advanced manifest JSON
                </summary>
                <Textarea
                    aria-label={`Updated manifest for ${manifest.name}`}
                    value={draftText}
                    onChange={(event) => setDraftText(event.target.value)}
                    rows={12}
                    className="mt-2 font-mono text-xs"
                    disabled={disabled}
                />
                {!draft && (
                    <Text as="p" role="alert" variant="meta" tone="error" className="mt-2">
                        Enter a valid JSON object to continue editing.
                    </Text>
                )}
                <Text as="p" variant="meta" tone="secondary" className="mt-2">
                    The app ID cannot change. New requested permissions stay unapproved until you enable them above.
                </Text>
            </details>
            {(launchUrlMissing || proxyUrlMissing) && (
                <Text as="p" role="alert" variant="meta" tone="error">
                    {proxyUrlMissing
                        ? 'Enter the private app URL for this connection.'
                        : 'Enter an app URL for this launch mode.'}
                </Text>
            )}
            <div className="flex flex-wrap gap-2">
                <Button
                    variant="subtle"
                    size="sm"
                    disabled={disabled || !draft || !changed || launchUrlMissing || proxyUrlMissing}
                    onClick={() =>
                        draft &&
                        onSave({
                            manifest: draft,
                            ...(launchMode === 'proxied' && proxyUrl.trim() ? { proxyUrl: proxyUrl.trim() } : {}),
                        })
                    }
                >
                    Update manifest
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled || !dirty}
                    onClick={() => {
                        setDraftText(savedText);
                        setProxyUrl('');
                    }}
                >
                    Reset
                </Button>
            </div>
        </div>
    );
}
