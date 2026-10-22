import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { getIntegrationErrorMessage, type IntegrationConnection, updateIntegration } from '~/apis/integration.api';
import { Button, Input, Label, Text } from '~/components/ui';
import { SETTINGS_MCP_ROUTE } from '~/modules/url';
import IntegrationPermissions from './IntegrationPermissions';
import IntegrationToken from './IntegrationToken';
import useIntegrationActions from './useIntegrationActions';

export default function IntegrationSetup({
    integration,
    onConnected,
}: {
    integration: IntegrationConnection;
    onConnected: () => void;
}) {
    const action = useIntegrationActions();
    const [address, setAddress] = useState('');
    const [grants, setGrants] = useState(integration.grantedPermissions);
    const needsNotes = integration.manifest.permissions.length > 0;
    const needsAddress = integration.manifest.launch?.mode === 'proxied' && !integration.proxyConfigured;
    const needsAccess = needsNotes && !integration.grantedPermissions.includes('notes:read');
    return (
        <div className="space-y-5">
            {needsAddress ? (
                <>
                    <Text as="h2" variant="subheading" weight="medium">
                        Where is your app running?
                    </Text>
                    <div className="space-y-2">
                        <Label htmlFor="setup-app-address">App address</Label>
                        <Input
                            id="setup-app-address"
                            aria-label="Private app URL"
                            type="url"
                            autoFocus
                            value={address}
                            placeholder="http://127.0.0.1:7778"
                            onChange={(event) => setAddress(event.target.value)}
                        />
                    </div>
                    <Button
                        disabled={action.pending || !address.trim()}
                        onClick={() =>
                            action.run(() => updateIntegration({ id: integration.id, proxyUrl: address.trim() }))
                        }
                    >
                        Continue
                    </Button>
                </>
            ) : needsAccess ? (
                <>
                    <Text as="h2" variant="subheading" weight="medium">
                        Choose what this app can access
                    </Text>
                    <IntegrationPermissions
                        requested={integration.manifest.permissions}
                        granted={grants}
                        onChange={setGrants}
                        disabled={action.pending}
                    />
                    <Button
                        disabled={action.pending || !grants.includes('notes:read')}
                        onClick={() =>
                            action.run(() => updateIntegration({ id: integration.id, grantedPermissions: grants }))
                        }
                    >
                        Continue
                    </Button>
                </>
            ) : integration.native ? (
                <>
                    <Text as="p" variant="meta" tone="secondary">
                        Connect your AI client to use your notes through MCP.
                    </Text>
                    <Button asChild>
                        <Link to={SETTINGS_MCP_ROUTE}>Connect AI client</Link>
                    </Button>
                </>
            ) : needsNotes ? (
                <IntegrationToken integration={integration} onConnected={onConnected} />
            ) : (
                <>
                    <Text as="p" variant="meta" tone="secondary">
                        This app does not need a token or access to your notes.
                    </Text>
                    <Button
                        disabled={action.pending}
                        onClick={() =>
                            action.run(() => updateIntegration({ id: integration.id, enabled: true }), onConnected)
                        }
                    >
                        Enable connection
                    </Button>
                </>
            )}
            {action.error && (
                <Text as="p" role="alert" variant="meta" tone="error">
                    {getIntegrationErrorMessage(action.error)}
                </Text>
            )}
        </div>
    );
}
