export const INTEGRATION_PERMISSIONS = ['notes:read', 'notes:create', 'notes:update', 'notes:delete'] as const;
export type IntegrationPermission = (typeof INTEGRATION_PERMISSIONS)[number];
export interface IntegrationManifest {
    schemaVersion: 1;
    apiVersion: 1;
    id: string;
    name: string;
    description: string;
    version: string;
    permissions: IntegrationPermission[];
    launch?: { url: string; mode: 'external' | 'iframe' } | { mode: 'proxied' };
}
export interface IntegrationConnection {
    id: string;
    native: boolean;
    manifest: IntegrationManifest;
    proxyConfigured: boolean;
    enabled: boolean;
    pinned: boolean;
    grantedPermissions: IntegrationPermission[];
    createdAt: string;
    updatedAt: string;
    token: { id: string; createdAt: string; lastUsedAt: string | null } | null;
}
export interface IntegrationUpdate {
    enabled?: boolean;
    pinned?: boolean;
    grantedPermissions?: IntegrationPermission[];
    manifest?: unknown;
    proxyUrl?: string;
}
