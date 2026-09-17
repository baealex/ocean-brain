import { createAppError } from '~/modules/error-handler.js';

export const INTEGRATION_PERMISSIONS = ['notes:read', 'notes:create', 'notes:update', 'notes:delete'] as const;
export type IntegrationPermission = (typeof INTEGRATION_PERMISSIONS)[number];
export const MCP_CONNECTION_ID = 'mcp';

export interface IntegrationManifest {
    schemaVersion: 1;
    apiVersion: 1;
    id: string;
    name: string;
    version: string;
    description: string;
    permissions: IntegrationPermission[];
    launch?: { url: string; mode: 'external' | 'iframe' };
}

export const MCP_INTEGRATION_MANIFEST: IntegrationManifest = {
    schemaVersion: 1,
    apiVersion: 1,
    id: 'ocean-brain.mcp',
    name: 'MCP',
    version: '1.0.0',
    description: 'Connect AI clients to Ocean Brain.',
    permissions: [...INTEGRATION_PERMISSIONS],
};

// New bundled integrations are registry entries, not schema migrations.
export const NATIVE_INTEGRATIONS = [{ connectionId: MCP_CONNECTION_ID, manifest: MCP_INTEGRATION_MANIFEST }] as const;

const invalid = (message: string): never => {
    throw createAppError(400, 'INVALID_INTEGRATION_MANIFEST', message);
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export const parsePermissions = (value: unknown): IntegrationPermission[] => {
    if (!Array.isArray(value) || value.some((item) => !INTEGRATION_PERMISSIONS.includes(item))) {
        return invalid('Permissions must be a list of supported note permissions.');
    }
    return [...new Set(value)] as IntegrationPermission[];
};

const textField = (value: unknown, name: string, max: number) => {
    if (typeof value !== 'string' || !value.trim() || value.length > max) {
        return invalid(`${name} must be a nonempty string of at most ${max} characters.`);
    }
    return value.trim();
};

export const parseManifest = (value: unknown): IntegrationManifest => {
    if (!isRecord(value)) return invalid('An integration manifest object is required.');
    if (value.schemaVersion !== 1 || value.apiVersion !== 1) {
        return invalid('Only manifest schemaVersion 1 and apiVersion 1 are supported.');
    }
    const id = textField(value.id, 'id', 100);
    if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(id))
        return invalid('id must be a lowercase dotted or dashed identifier.');
    const manifest: IntegrationManifest = {
        schemaVersion: 1,
        apiVersion: 1,
        id,
        name: textField(value.name, 'name', 80),
        version: textField(value.version, 'version', 40),
        description: textField(value.description, 'description', 500),
        permissions: parsePermissions(value.permissions),
    };
    if (
        manifest.permissions.some((permission) => permission !== 'notes:read') &&
        !manifest.permissions.includes('notes:read')
    ) {
        return invalid('An integration requesting write access must also request notes:read.');
    }
    if (value.launch !== undefined) {
        if (!isRecord(value.launch) || !['external', 'iframe'].includes(String(value.launch.mode))) {
            return invalid('launch requires a url and mode (external or iframe).');
        }
        let url: URL;
        try {
            url = new URL(textField(value.launch.url, 'launch.url', 2000));
        } catch {
            return invalid('launch.url must be an absolute HTTP(S) URL.');
        }
        const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password) {
            return invalid('launch.url requires HTTPS (HTTP is allowed on loopback only), without credentials.');
        }
        manifest.launch = { url: url.href, mode: value.launch.mode === 'iframe' ? 'iframe' : 'external' };
    }
    return manifest;
};

export const validateGrants = (value: unknown, manifest: IntegrationManifest) => {
    const permissions = parsePermissions(value);
    if (permissions.some((permission) => !manifest.permissions.includes(permission))) {
        throw createAppError(400, 'INVALID_INTEGRATION_GRANTS', 'A grant must be requested by the manifest.');
    }
    if (permissions.some((permission) => permission !== 'notes:read') && !permissions.includes('notes:read')) {
        throw createAppError(400, 'INVALID_INTEGRATION_GRANTS', 'Write permissions also require notes:read.');
    }
    return permissions;
};
