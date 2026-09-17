import axios from 'axios';
import type { IntegrationConnection, IntegrationPermission, IntegrationUpdate } from './integration.types';

const root = '/api/integration-admin/connections';
export const fetchIntegrations = async () =>
    (await axios.get<{ connections: IntegrationConnection[] }>(root)).data.connections;
export const connectIntegration = async (input: { manifest: unknown; grantedPermissions: IntegrationPermission[] }) =>
    (await axios.post<IntegrationConnection>(root, input)).data;
export const updateIntegration = async ({ id, ...input }: IntegrationUpdate & { id: string }) =>
    (await axios.patch<IntegrationConnection>(`${root}/${encodeURIComponent(id)}`, input)).data;
export const disconnectIntegration = async (id: string) => {
    await axios.delete(`${root}/${encodeURIComponent(id)}`);
};
export const rotateIntegrationToken = async (id: string) =>
    (await axios.post<{ token: string }>(`${root}/${encodeURIComponent(id)}/token/rotate`)).data;
export const revokeIntegrationToken = async (id: string) => {
    await axios.post(`${root}/${encodeURIComponent(id)}/token/revoke`);
};
