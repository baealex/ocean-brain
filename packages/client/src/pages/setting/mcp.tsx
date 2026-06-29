import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchMcpAdminStatus, revokeMcpToken, rotateMcpToken, setMcpEnabled } from '~/apis/mcp-admin.api';
import * as Icon from '~/components/icon';
import { Button, PageLayout } from '~/components/shared';
import {
    Input,
    Label,
    Switch,
    Text,
    Textarea,
    ToggleGroup,
    ToggleGroupItem,
    useConfirm,
    useToast,
} from '~/components/ui';

const mcpAdminStatusQueryKey = ['mcp-admin', 'status'] as const;

type ClientGuide = 'codex' | 'claude' | 'json';

const shellQuote = (value: string) => {
    if (/^[A-Za-z0-9_./:@$-]+$/.test(value)) {
        return value;
    }

    return `'${value.replace(/'/g, "'\\''")}'`;
};

const defaultTokenFilePath = '$HOME/.config/ocean-brain/mcp-token';

const createTokenFileCommand = (tokenFilePath: string, token: string) => {
    const quotedPath = shellQuote(tokenFilePath);

    return [
        `mkdir -p "$(dirname ${quotedPath})"`,
        `printf '%s' ${shellQuote(token)} > ${quotedPath}`,
        `chmod 600 ${quotedPath}`,
    ].join('\n');
};

const buildOceanBrainMcpArgs = (serverUrl: string, tokenFilePath: string) => {
    return `npx -y ocean-brain mcp --server ${shellQuote(serverUrl)} --token-file ${shellQuote(tokenFilePath)}`;
};

const createCodexCommand = (serverUrl: string, tokenFilePath: string) => {
    return `codex mcp add ocean-brain -- ${buildOceanBrainMcpArgs(serverUrl, tokenFilePath)}`;
};

const createClaudeCommand = (serverUrl: string, tokenFilePath: string) => {
    return `claude mcp add --transport stdio ocean-brain -- ${buildOceanBrainMcpArgs(serverUrl, tokenFilePath)}`;
};

const createMcpJsonSnippet = (serverUrl: string, tokenFilePath: string) => {
    return JSON.stringify(
        {
            mcpServers: {
                'ocean-brain': {
                    command: 'npx',
                    args: ['-y', 'ocean-brain', 'mcp', '--server', serverUrl, '--token-file', tokenFilePath],
                },
            },
        },
        null,
        2,
    );
};

const createConnectionOutput = (clientGuide: ClientGuide, serverUrl: string, tokenFilePath: string, token: string) => {
    const connectCommand =
        clientGuide === 'codex'
            ? createCodexCommand(serverUrl, tokenFilePath)
            : clientGuide === 'claude'
              ? createClaudeCommand(serverUrl, tokenFilePath)
              : createMcpJsonSnippet(serverUrl, tokenFilePath);

    if (clientGuide === 'json') {
        return [
            `# 1. Create the token file`,
            createTokenFileCommand(tokenFilePath, token),
            '',
            '# 2. Add this MCP JSON',
            connectCommand,
        ].join('\n');
    }

    return [
        `# 1. Create the token file`,
        createTokenFileCommand(tokenFilePath, token),
        '',
        `# 2. Add Ocean Brain to ${clientGuide}`,
        connectCommand,
    ].join('\n');
};

const getMcpCompatibilityLabel = (requirement?: string) => {
    if (!requirement || requirement === 'unknown') {
        return 'MCP compatibility';
    }

    return `MCP compatibility ${requirement}`;
};

const clientGuideLabel: Record<ClientGuide, string> = {
    codex: 'Codex',
    claude: 'Claude',
    json: 'JSON',
};

const McpSetting = () => {
    const confirm = useConfirm();
    const toast = useToast();
    const queryClient = useQueryClient();

    const [serverUrl, setServerUrl] = useState(() => window.location.origin);
    const [issuedToken, setIssuedToken] = useState('');
    const [tokenFilePath, setTokenFilePath] = useState(defaultTokenFilePath);
    const [clientGuide, setClientGuide] = useState<ClientGuide>('codex');

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
            toast('New MCP token issued. Previous token is no longer valid.');
            await queryClient.invalidateQueries({ queryKey: mcpAdminStatusQueryKey });
        },
    });

    const revokeTokenMutation = useMutation({
        mutationFn: revokeMcpToken,
        onSuccess: (nextStatus) => {
            setIssuedToken('');
            queryClient.setQueryData(mcpAdminStatusQueryKey, nextStatus);
            toast('MCP token revoked. Existing client configs will stop working.');
        },
    });

    const enabled = status?.enabled ?? false;
    const hasActiveToken = status?.hasActiveToken ?? false;
    const canToggle = !isLoading && !setEnabledMutation.isPending;
    const normalizedTokenFilePath = tokenFilePath.trim() || defaultTokenFilePath;
    const mcpCompatibilityLabel = getMcpCompatibilityLabel(status?.server.mcpVersionRequirement);
    const tokenStatusText = hasActiveToken ? '1 active token' : 'No active token';
    const outputLabel = clientGuide === 'json' ? 'Token file and MCP JSON' : `${clientGuideLabel[clientGuide]} setup`;
    const tokenValue = issuedToken || 'PASTE_TOKEN_HERE';
    const connectionOutput = createConnectionOutput(clientGuide, serverUrl, normalizedTokenFilePath, tokenValue);
    const copyLabel = 'Copy setup';

    const sectionHeadingClassName = 'text-fg-tertiary';
    const fieldLabelClassName = 'font-medium text-fg-tertiary';
    const rowClassName = 'surface-base px-4 py-3.5';
    const fieldGroupClassName = 'space-y-2';
    const outputTextAreaClassName =
        'max-w-full overflow-x-auto whitespace-pre font-mono text-xs leading-5 text-fg-secondary';

    const handleCopyToken = async () => {
        try {
            await navigator.clipboard.writeText(issuedToken);
            toast('Copied token.');
        } catch {
            toast('Failed to copy token.');
        }
    };

    const handleCopyConnection = async () => {
        try {
            await navigator.clipboard.writeText(connectionOutput);
            toast(clientGuide === 'json' ? 'Copied MCP JSON.' : 'Copied MCP command.');
        } catch {
            toast(`Could not copy. Select the ${clientGuide === 'json' ? 'JSON' : 'command'} and copy it manually.`);
        }
    };

    const handleRotateToken = async () => {
        if (
            hasActiveToken &&
            !(await confirm(
                'Rotate the MCP token? Existing MCP clients will stop working until they use the new token.',
            ))
        ) {
            return;
        }

        rotateTokenMutation.mutate(undefined);
    };

    const handleRevokeToken = async () => {
        if (!(await confirm('Revoke the MCP token? Existing MCP clients will stop working immediately.'))) {
            return;
        }

        revokeTokenMutation.mutate();
    };

    return (
        <PageLayout
            title="MCP"
            variant="default"
            description="Connect this Ocean Brain instance to MCP clients."
            headerRight={
                <div className="inline-flex items-center gap-3 rounded-[14px] border border-border-subtle bg-muted px-3 py-2">
                    <Text as="span" variant="meta" weight="medium" tone="secondary">
                        MCP access {enabled ? 'on' : 'off'}
                    </Text>
                    <Switch
                        aria-label="MCP access"
                        checked={enabled}
                        disabled={!canToggle}
                        onCheckedChange={() => {
                            setEnabledMutation.mutate(!enabled);
                        }}
                    />
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <section className="flex flex-col gap-3" aria-labelledby="mcp-connect-heading">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                            <Text
                                id="mcp-connect-heading"
                                as="h2"
                                variant="label"
                                weight="medium"
                                className={sectionHeadingClassName}
                            >
                                Connect a client
                            </Text>
                            <Text as="p" variant="meta" tone="secondary">
                                Save your token in a local file, then copy the command for your client.
                            </Text>
                        </div>
                        <Text
                            as="span"
                            variant="meta"
                            weight="medium"
                            tone="tertiary"
                            className="rounded-full border border-border-subtle bg-hover-subtle px-2.5 py-1"
                        >
                            {mcpCompatibilityLabel}
                        </Text>
                    </div>

                    <div className={`${rowClassName} flex flex-col gap-3`}>
                        <div className="flex flex-wrap items-center gap-3">
                            <ToggleGroup
                                type="single"
                                variant="quiet"
                                size="sm"
                                value={clientGuide}
                                onValueChange={(value) => {
                                    if (value === 'codex' || value === 'claude' || value === 'json') {
                                        setClientGuide(value);
                                    }
                                }}
                            >
                                <ToggleGroupItem value="codex">Codex</ToggleGroupItem>
                                <ToggleGroupItem value="claude">Claude</ToggleGroupItem>
                                <ToggleGroupItem value="json">JSON</ToggleGroupItem>
                            </ToggleGroup>
                        </div>

                        <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <Label htmlFor="mcp-connection-output" className={fieldLabelClassName}>
                                    {outputLabel}
                                </Label>
                                <Button type="button" variant="subtle" size="sm" onClick={handleCopyConnection}>
                                    <Icon.Copy className="h-4 w-4" />
                                    {copyLabel}
                                </Button>
                            </div>
                            <Textarea
                                id="mcp-connection-output"
                                readOnly
                                rows={clientGuide === 'json' ? 13 : 9}
                                wrap="off"
                                value={connectionOutput}
                                className={outputTextAreaClassName}
                            />
                            <Text as="p" variant="meta" tone="tertiary">
                                {issuedToken
                                    ? 'The new token is already included in the token file step.'
                                    : 'Replace PASTE_TOKEN_HERE before running. The MCP client reads the token from that file.'}
                            </Text>
                        </div>

                        <details className="group rounded-[12px] border border-border-subtle bg-muted">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:hidden">
                                <Text as="span" variant="meta" weight="medium" tone="secondary">
                                    Connection options
                                </Text>
                                <Icon.ChevronDown
                                    className="h-4 w-4 shrink-0 text-fg-tertiary transition-transform group-open:rotate-180"
                                    aria-hidden="true"
                                />
                            </summary>
                            <div className="space-y-3 border-t border-border-subtle px-3 py-3">
                                <div className={fieldGroupClassName}>
                                    <Label htmlFor="mcp-server-url" className={fieldLabelClassName}>
                                        Ocean Brain URL
                                    </Label>
                                    <Input
                                        id="mcp-server-url"
                                        value={serverUrl}
                                        onChange={(event) => setServerUrl(event.target.value)}
                                    />
                                </div>

                                <div className={fieldGroupClassName}>
                                    <Label htmlFor="mcp-token-file-path" className={fieldLabelClassName}>
                                        Token file path
                                    </Label>
                                    <Input
                                        id="mcp-token-file-path"
                                        placeholder="/absolute/path/to/ocean-brain-mcp-token.txt"
                                        value={tokenFilePath}
                                        onChange={(event) => setTokenFilePath(event.target.value)}
                                    />
                                </div>
                            </div>
                        </details>
                    </div>
                </section>

                <section className="flex flex-col gap-3" aria-labelledby="mcp-token-heading">
                    <div className={`${rowClassName} flex flex-wrap items-center justify-between gap-3`}>
                        <div className="min-w-0 space-y-1">
                            <Text
                                id="mcp-token-heading"
                                as="h2"
                                variant="label"
                                weight="medium"
                                className={sectionHeadingClassName}
                            >
                                Token
                            </Text>
                            <Text as="p" variant="meta" tone="tertiary">
                                {tokenStatusText}. New tokens are shown once.
                            </Text>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant={hasActiveToken ? 'subtle' : 'primary'}
                                onClick={handleRotateToken}
                                isLoading={rotateTokenMutation.isPending}
                            >
                                {hasActiveToken ? 'Rotate token' : 'Issue token'}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="soft-danger"
                                onClick={handleRevokeToken}
                                isLoading={revokeTokenMutation.isPending}
                                disabled={!hasActiveToken}
                            >
                                Revoke token
                            </Button>
                        </div>
                    </div>

                    {issuedToken && (
                        <div className={`${rowClassName} border-dashed`}>
                            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="issued-mcp-token" className={fieldLabelClassName}>
                                        New token
                                    </Label>
                                    <Text as="p" variant="meta" tone="secondary">
                                        Copy this token now and save it in your token file.
                                    </Text>
                                </div>
                                <Button type="button" variant="subtle" size="sm" onClick={handleCopyToken}>
                                    <Icon.Copy className="h-4 w-4" />
                                    Copy token
                                </Button>
                            </div>
                            <Textarea id="issued-mcp-token" rows={3} readOnly value={issuedToken} />
                        </div>
                    )}
                </section>
            </div>
        </PageLayout>
    );
};

export default McpSetting;
