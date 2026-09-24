import { useId, useState } from 'react';
import {
    getIntegrationErrorMessage,
    type IntegrationConnection,
    revokeIntegrationToken,
    rotateIntegrationToken,
    updateIntegration,
} from '~/apis/integration.api';
import * as Icon from '~/components/icon';
import { Button, Input, Label, Text, useConfirm, useToast } from '~/components/ui';
import useIntegrationActions from './useIntegrationActions';

export default function IntegrationToken({
    integration,
    onConnected,
}: {
    integration: IntegrationConnection;
    onConnected?: () => void;
}) {
    const id = useId();
    const confirm = useConfirm();
    const toast = useToast();
    const action = useIntegrationActions();
    const [token, setToken] = useState('');
    const copy = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            toast('Copied.');
        } catch {
            toast('Could not copy. Select the value and copy it manually.');
        }
    };
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <Text as="h2" variant="subheading" weight="medium">
                    {onConnected ? 'Save a token in your app' : 'App token'}
                </Text>
                <Text as="p" variant="meta" tone="secondary">
                    {token
                        ? 'Save this token now. It is shown only once.'
                        : integration.token
                          ? 'A token has been created. Use the one saved in your app, or replace it.'
                          : 'Create a token so this app can use the access you approved.'}
                </Text>
            </div>
            {(onConnected || token) && (
                <div className="space-y-2">
                    <Label htmlFor={`${id}-server`}>Ocean Brain URL</Label>
                    <div className="flex items-center gap-2">
                        <Input id={`${id}-server`} readOnly value={window.location.origin} />
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Copy server URL"
                            onClick={() => copy(window.location.origin)}
                        >
                            <Icon.Copy aria-hidden="true" className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
            {token && (
                <div className="space-y-2">
                    <Label htmlFor={`${id}-token`}>App token</Label>
                    <Input
                        id={`${id}-token`}
                        aria-label="Save this token now. It is shown only once."
                        readOnly
                        autoComplete="off"
                        className="font-mono text-xs"
                        value={token}
                    />
                    <Button variant="subtle" size="sm" onClick={() => copy(token)}>
                        <Icon.Copy aria-hidden="true" className="h-4 w-4" />
                        Copy token
                    </Button>
                </div>
            )}
            <div className="flex flex-wrap gap-2">
                {!token && (
                    <Button
                        variant={integration.token ? 'subtle' : 'primary'}
                        size="sm"
                        disabled={action.pending}
                        onClick={async () => {
                            if (
                                integration.token &&
                                !(await confirm(
                                    'Replace this integration token? Existing connections using it will stop working.',
                                ))
                            )
                                return;
                            action.run(async () => {
                                const issued = await rotateIntegrationToken(integration.id);
                                setToken(issued.token);
                            });
                        }}
                    >
                        {integration.token ? 'Replace token' : 'Generate token'}
                    </Button>
                )}
                {!onConnected && integration.token && (
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={action.pending}
                        onClick={async () => {
                            if (!(await confirm('Revoke this integration token? Its connections will lose access.')))
                                return;
                            action.run(async () => {
                                await revokeIntegrationToken(integration.id);
                                setToken('');
                            });
                        }}
                    >
                        Revoke token
                    </Button>
                )}
                {!onConnected && token && (
                    <Button variant="ghost" size="sm" onClick={() => setToken('')}>
                        Hide token
                    </Button>
                )}
            </div>
            {onConnected && (
                <Button
                    disabled={action.pending || (!integration.token && !token)}
                    onClick={() =>
                        action.run(() => updateIntegration({ id: integration.id, enabled: true }), onConnected)
                    }
                >
                    {integration.enabled ? 'Done' : 'Enable connection'}
                </Button>
            )}
            {action.error && (
                <Text as="p" variant="meta" tone="error" role="alert">
                    {getIntegrationErrorMessage(action.error)}
                </Text>
            )}
        </div>
    );
}
