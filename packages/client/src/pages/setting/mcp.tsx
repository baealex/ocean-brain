import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button, Callout, PageLayout, SurfaceCard } from '~/components/shared';
import {
    Input,
    Label,
    Switch,
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
        <PageLayout title="MCP" description="Manage MCP access and issue a single service token">
            <div className="grid grid-cols-1 gap-4">
                <SurfaceCard className="p-4 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-base font-semibold text-fg-default">MCP Access</h2>
                            <p className="text-xs font-medium text-fg-tertiary">
                                Allow or block MCP requests at the server level.
                            </p>
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

                <SurfaceCard className="p-4 space-y-4">
                    <div>
                        <h2 className="text-base font-semibold text-fg-default">Token Management</h2>
                        <p className="text-xs font-medium text-fg-tertiary">
                            Ocean Brain supports one active MCP token per service.
                        </p>
                    </div>
                    <Callout>
                        Rotating token invalidates previous token immediately.
                    </Callout>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            onClick={() => rotateTokenMutation.mutate(undefined)}
                            isLoading={rotateTokenMutation.isPending}>
                            Rotate token
                        </Button>
                        <Button
                            variant="ghost"
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

                <SurfaceCard className="p-4 space-y-4">
                    <div>
                        <h2 className="text-base font-semibold text-fg-default">Connection Guide</h2>
                        <p className="text-xs font-medium text-fg-tertiary">
                            Default server URL uses current origin. Change it when registering a public host.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="mcp-server-url">MCP Server URL</Label>
                        <Input
                            id="mcp-server-url"
                            value={serverUrl}
                            onChange={(event) => setServerUrl(event.target.value)}
                        />
                    </div>
                    <Callout>
                        Recommended: <code>--token-file</code>. For quick local tests, <code>--token</code> also works.
                    </Callout>
                    <div className="space-y-2">
                        <Label>Recommended (.mcp.json with token file)</Label>
                        <pre className="overflow-x-auto rounded-[14px] border border-border-subtle bg-surface px-4 py-3 text-xs text-fg-secondary">
                            {createTokenFileMcpJsonSnippet(serverUrl)}
                        </pre>
                    </div>
                </SurfaceCard>
            </div>
        </PageLayout>
    );
};

export default McpSetting;
