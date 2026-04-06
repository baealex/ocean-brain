import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button, PageLayout, SurfaceCard } from '~/components/shared';
import {
    Input,
    Label,
    Switch,
    Text,
    Textarea,
    useToast
} from '~/components/ui';
import {
    fetchMcpAdminStatus,
    revokeMcpToken,
    rotateMcpToken,
    setMcpEnabled
} from '~/apis/mcp-admin.api';

const mcpAdminStatusQueryKey = ['mcp-admin', 'status'] as const;

const createTokenFileMcpJsonSnippet = (serverUrl: string) => {
    return JSON.stringify({
        mcpServers: {
            'ocean-brain': {
                command: 'npx',
                args: [
                    '-y',
                    'ocean-brain',
                    'mcp',
                    '--server',
                    serverUrl,
                    '--token-file',
                    '/path/to/token.txt'
                ]
            }
        }
    }, null, 2);
};

const createInlineTokenMcpJsonSnippet = (serverUrl: string) => {
    return JSON.stringify({
        mcpServers: {
            'ocean-brain': {
                command: 'npx',
                args: [
                    '-y',
                    'ocean-brain',
                    'mcp',
                    '--server',
                    serverUrl,
                    '--token',
                    'your-token-here'
                ]
            }
        }
    }, null, 2);
};

const McpSetting = () => {
    const toast = useToast();
    const queryClient = useQueryClient();

    const [serverUrl, setServerUrl] = useState(() => window.location.origin);
    const [issuedToken, setIssuedToken] = useState('');

    const { data: status, isLoading } = useQuery({
        queryKey: mcpAdminStatusQueryKey,
        queryFn: fetchMcpAdminStatus
    });

    const setEnabledMutation = useMutation({
        mutationFn: setMcpEnabled,
        onSuccess: (nextStatus) => {
            queryClient.setQueryData(mcpAdminStatusQueryKey, nextStatus);
            toast(nextStatus.enabled ? 'MCP access enabled.' : 'MCP access disabled.');
        }
    });

    const rotateTokenMutation = useMutation({
        mutationFn: rotateMcpToken,
        onSuccess: async ({ token }) => {
            setIssuedToken(token);
            toast('A new MCP token has been issued.');
            await queryClient.invalidateQueries({ queryKey: mcpAdminStatusQueryKey });
        }
    });

    const revokeTokenMutation = useMutation({
        mutationFn: revokeMcpToken,
        onSuccess: (nextStatus) => {
            setIssuedToken('');
            queryClient.setQueryData(mcpAdminStatusQueryKey, nextStatus);
            toast('The active MCP token has been revoked.');
        }
    });

    const enabled = status?.enabled ?? false;
    const canToggle = !isLoading && !setEnabledMutation.isPending;

    return (
        <PageLayout title="MCP" variant="subtle" description="Manage MCP access and issue a single service token">
            <div className="grid grid-cols-1 gap-4">
                <SurfaceCard className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <Text as="h2" variant="subheading" weight="semibold">
                                MCP Access
                            </Text>
                            <Text as="p" variant="label" weight="medium" tone="tertiary">
                                Allow or block MCP requests at the server level.
                            </Text>
                        </div>
                        <div className="inline-flex items-center">
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

                <SurfaceCard className="space-y-4">
                    <div className="border-b border-border-subtle pb-4">
                        <Text as="h2" variant="subheading" weight="semibold">
                            Token Management
                        </Text>
                        <Text as="p" variant="label" weight="medium" tone="tertiary">
                            Ocean Brain supports one active MCP token at a time. Rotating immediately invalidates the previous one.
                        </Text>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            onClick={() => rotateTokenMutation.mutate(undefined)}
                            isLoading={rotateTokenMutation.isPending}>
                            Rotate token
                        </Button>
                        <Button
                            variant="soft-danger"
                            onClick={() => revokeTokenMutation.mutate()}
                            isLoading={revokeTokenMutation.isPending}
                            disabled={!status?.hasActiveToken}>
                            Revoke token
                        </Button>
                    </div>
                    {issuedToken && (
                        <div className="space-y-2">
                            <Label htmlFor="issued-mcp-token">Issued Token</Label>
                            <Textarea
                                id="issued-mcp-token"
                                rows={3}
                                readOnly
                                value={issuedToken}
                            />
                        </div>
                    )}
                </SurfaceCard>

                <SurfaceCard className="space-y-4">
                    <div className="border-b border-border-subtle pb-4">
                        <Text as="h2" variant="subheading" weight="semibold">
                            Connection Guide
                        </Text>
                        <Text as="p" variant="label" weight="medium" tone="tertiary">
                            How to connect your MCP client to this server.
                        </Text>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="mcp-server-url">Server URL</Label>
                        <Input
                            id="mcp-server-url"
                            value={serverUrl}
                            onChange={(event) => setServerUrl(event.target.value)}
                        />
                    </div>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Text as="p" variant="body" weight="semibold">
                                Token file{' '}
                                <Text as="span" variant="label" weight="medium" tone="tertiary">
                                    (recommended - keeps token out of config)
                                </Text>
                            </Text>
                            <pre className="overflow-x-auto rounded-[14px] border border-border-subtle bg-surface px-4 py-3 text-xs text-fg-secondary">
                                {createTokenFileMcpJsonSnippet(serverUrl)}
                            </pre>
                        </div>
                        <div className="space-y-2">
                            <Text as="p" variant="body" weight="semibold">
                                Inline token{' '}
                                <Text as="span" variant="label" weight="medium" tone="tertiary">
                                    (quick local testing)
                                </Text>
                            </Text>
                            <pre className="overflow-x-auto rounded-[14px] border border-border-subtle bg-surface px-4 py-3 text-xs text-fg-secondary">
                                {createInlineTokenMcpJsonSnippet(serverUrl)}
                            </pre>
                        </div>
                    </div>
                </SurfaceCard>
            </div>
        </PageLayout>
    );
};

export default McpSetting;
