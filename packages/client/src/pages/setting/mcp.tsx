import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchMcpAdminStatus, revokeMcpToken, rotateMcpToken, setMcpEnabled } from '~/apis/mcp-admin.api';
import { Button, PageLayout, SurfaceCard } from '~/components/shared';
import { Input, Label, Switch, Text, Textarea, ToggleGroup, ToggleGroupItem, useToast } from '~/components/ui';

const mcpAdminStatusQueryKey = ['mcp-admin', 'status'] as const;

const createTokenFileMcpJsonSnippet = (serverUrl: string) => {
    return JSON.stringify(
        {
            mcpServers: {
                'ocean-brain': {
                    command: 'npx',
                    args: ['-y', 'ocean-brain', 'mcp', '--server', serverUrl, '--token-file', '/path/to/token.txt'],
                },
            },
        },
        null,
        2,
    );
};

const createInlineTokenMcpJsonSnippet = (serverUrl: string) => {
    return JSON.stringify(
        {
            mcpServers: {
                'ocean-brain': {
                    command: 'npx',
                    args: ['-y', 'ocean-brain', 'mcp', '--server', serverUrl, '--token', 'your-token-here'],
                },
            },
        },
        null,
        2,
    );
};

const McpSetting = () => {
    const toast = useToast();
    const queryClient = useQueryClient();

    const [serverUrl, setServerUrl] = useState(() => window.location.origin);
    const [issuedToken, setIssuedToken] = useState('');
    const [guideMode, setGuideMode] = useState<'token-file' | 'inline-token'>('token-file');

    const { data: status, isLoading } = useQuery({
        queryKey: mcpAdminStatusQueryKey,
        queryFn: fetchMcpAdminStatus,
    });

    const setEnabledMutation = useMutation({
        mutationFn: setMcpEnabled,
        onSuccess: (nextStatus) => {
            queryClient.setQueryData(mcpAdminStatusQueryKey, nextStatus);
            toast(nextStatus.enabled ? 'MCP access enabled.' : 'MCP access disabled.');
        },
    });

    const rotateTokenMutation = useMutation({
        mutationFn: rotateMcpToken,
        onSuccess: async ({ token }) => {
            setIssuedToken(token);
            toast('A new MCP token has been issued.');
            await queryClient.invalidateQueries({ queryKey: mcpAdminStatusQueryKey });
        },
    });

    const revokeTokenMutation = useMutation({
        mutationFn: revokeMcpToken,
        onSuccess: (nextStatus) => {
            setIssuedToken('');
            queryClient.setQueryData(mcpAdminStatusQueryKey, nextStatus);
            toast('The active MCP token has been revoked.');
        },
    });

    const enabled = status?.enabled ?? false;
    const hasActiveToken = status?.hasActiveToken ?? false;
    const canToggle = !isLoading && !setEnabledMutation.isPending;
    const headerTextClassName = 'space-y-1';
    const cardBodyClassName = 'space-y-4.5';
    const statusToggleClassName =
        'inline-flex items-center gap-3 rounded-[14px] border border-border-subtle bg-muted px-3 py-2';
    const activeTokenBadgeClassName = 'rounded-full border border-border-subtle bg-hover-subtle px-2.5 py-1';
    const guidePanelClassName = 'space-y-3 rounded-[16px] border border-border-subtle bg-surface px-4 py-3';
    const guideSnippetClassName =
        'overflow-x-auto rounded-[14px] border border-border-subtle bg-surface px-4 py-3 text-xs text-fg-secondary';
    const cardTitleProps = {
        variant: 'subheading' as const,
        weight: 'medium' as const,
        tracking: 'tight' as const,
    };
    const fieldLabelClassName = 'font-medium text-fg-tertiary';
    const activeGuide =
        guideMode === 'token-file'
            ? {
                  title: 'Token file',
                  description: 'Recommended. Keeps the token out of config.',
                  snippet: createTokenFileMcpJsonSnippet(serverUrl),
              }
            : {
                  title: 'Inline token',
                  description: 'Useful for quick local testing.',
                  snippet: createInlineTokenMcpJsonSnippet(serverUrl),
              };

    return (
        <PageLayout title="MCP" variant="default" description="Manage MCP access, tokens, and connection details">
            <div className="grid grid-cols-1 gap-4">
                <SurfaceCard tone="elevated">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className={headerTextClassName}>
                            <Text as="h2" {...cardTitleProps}>
                                MCP Access
                            </Text>
                            <Text as="p" variant="meta" tone="secondary">
                                Allow or block MCP requests at the server level.
                            </Text>
                        </div>
                        <div className={statusToggleClassName}>
                            <Text as="span" variant="meta" weight="medium" tone="secondary">
                                {enabled ? 'Enabled' : 'Disabled'}
                            </Text>
                            <Switch
                                aria-label="Allow MCP access"
                                checked={enabled}
                                disabled={!canToggle}
                                onCheckedChange={() => {
                                    setEnabledMutation.mutate(!enabled);
                                }}
                            />
                        </div>
                    </div>
                </SurfaceCard>

                <SurfaceCard tone="elevated">
                    <div className={cardBodyClassName}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className={headerTextClassName}>
                                <Text as="h2" {...cardTitleProps}>
                                    Token Management
                                </Text>
                                <Text as="p" variant="meta" tone="secondary" className="max-w-[64ch]">
                                    Ocean Brain supports one active MCP token at a time. Rotating immediately
                                    invalidates the previous one.
                                </Text>
                            </div>
                            <Text
                                as="span"
                                variant="meta"
                                weight="medium"
                                tone={hasActiveToken ? 'secondary' : 'tertiary'}
                                className={activeTokenBadgeClassName}
                            >
                                {hasActiveToken ? '1 active token' : 'No active token'}
                            </Text>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                            <Button
                                onClick={() => rotateTokenMutation.mutate(undefined)}
                                isLoading={rotateTokenMutation.isPending}
                            >
                                Rotate token
                            </Button>
                            <Button
                                variant="soft-danger"
                                onClick={() => revokeTokenMutation.mutate()}
                                isLoading={revokeTokenMutation.isPending}
                                disabled={!hasActiveToken}
                            >
                                Revoke token
                            </Button>
                        </div>
                        {issuedToken && (
                            <div className="space-y-2.5">
                                <Label htmlFor="issued-mcp-token" className={fieldLabelClassName}>
                                    Issued token
                                </Label>
                                <Textarea id="issued-mcp-token" rows={3} readOnly value={issuedToken} />
                            </div>
                        )}
                    </div>
                </SurfaceCard>

                <SurfaceCard tone="elevated">
                    <div className={cardBodyClassName}>
                        <div className={headerTextClassName}>
                            <Text as="h2" {...cardTitleProps}>
                                Connection Guide
                            </Text>
                            <Text as="p" variant="meta" tone="secondary">
                                Connect your MCP client with either a token file or an inline token.
                            </Text>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="mcp-server-url" className={fieldLabelClassName}>
                                Server URL
                            </Label>
                            <Input
                                id="mcp-server-url"
                                value={serverUrl}
                                onChange={(event) => setServerUrl(event.target.value)}
                            />
                        </div>
                        <div className="space-y-3">
                            <ToggleGroup
                                type="single"
                                variant="pills"
                                size="sm"
                                value={guideMode}
                                onValueChange={(value) => {
                                    if (value === 'token-file' || value === 'inline-token') {
                                        setGuideMode(value);
                                    }
                                }}
                            >
                                <ToggleGroupItem value="token-file">Token file</ToggleGroupItem>
                                <ToggleGroupItem value="inline-token">Inline token</ToggleGroupItem>
                            </ToggleGroup>
                            <div className={guidePanelClassName}>
                                <div className={headerTextClassName}>
                                    <Text as="p" variant="meta" weight="semibold">
                                        {activeGuide.title}
                                    </Text>
                                    <Text as="p" variant="meta" tone="secondary">
                                        {activeGuide.description}
                                    </Text>
                                </div>
                                <pre className={guideSnippetClassName}>{activeGuide.snippet}</pre>
                            </div>
                        </div>
                    </div>
                </SurfaceCard>
            </div>
        </PageLayout>
    );
};

export default McpSetting;
