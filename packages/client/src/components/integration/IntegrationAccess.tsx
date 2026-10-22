import { useState } from 'react';
import { getIntegrationErrorMessage, type IntegrationConnection, updateIntegration } from '~/apis/integration.api';
import { Button, Text } from '~/components/ui';
import IntegrationPermissions from './IntegrationPermissions';
import useIntegrationActions from './useIntegrationActions';

export default function IntegrationAccess({ integration }: { integration: IntegrationConnection }) {
    const [grants, setGrants] = useState(integration.grantedPermissions);
    const action = useIntegrationActions();
    const changed = JSON.stringify([...grants].sort()) !== JSON.stringify([...integration.grantedPermissions].sort());
    return (
        <div className="space-y-4">
            <IntegrationPermissions
                requested={integration.manifest.permissions}
                granted={grants}
                onChange={setGrants}
                disabled={action.pending}
            />
            <Button
                disabled={!changed || action.pending}
                onClick={() => action.run(() => updateIntegration({ id: integration.id, grantedPermissions: grants }))}
            >
                Save access
            </Button>
            {action.error && (
                <Text as="p" role="alert" variant="meta" tone="error">
                    {getIntegrationErrorMessage(action.error)}
                </Text>
            )}
        </div>
    );
}
