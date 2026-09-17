import type { IntegrationConnection, IntegrationPermission, IntegrationUpdate } from './integration.types';
export const fetchIntegrations = async (): Promise<IntegrationConnection[]> => [];
const unavailable = (): never => {
    throw new Error('Integrations require an Ocean Brain server.');
};
export const connectIntegration = async (_input: {
    manifest: unknown;
    grantedPermissions: IntegrationPermission[];
}): Promise<IntegrationConnection> => unavailable();
export const updateIntegration = async (_input: IntegrationUpdate & { id: string }): Promise<IntegrationConnection> =>
    unavailable();
export const disconnectIntegration = async (_id: string): Promise<void> => unavailable();
export const rotateIntegrationToken = async (_id: string): Promise<{ token: string }> => unavailable();
export const revokeIntegrationToken = async (_id: string): Promise<void> => unavailable();
