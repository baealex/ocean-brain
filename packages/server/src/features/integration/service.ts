import { createHash } from 'node:crypto';
import models, { type IntegrationConnection, type PrismaClient } from '~/models.js';
import { createAppError } from '~/modules/error-handler.js';
import { issueIntegrationToken } from '~/modules/integration-token.js';
import { emitIntegrationAccessChanged } from './access-events.js';
import {
    type IntegrationPermission,
    MCP_CONNECTION_ID,
    NATIVE_INTEGRATIONS,
    parseIntegrationProxyUrl,
    parseManifest,
    parsePermissions,
    validateGrants,
} from './manifest.js';

export interface IntegrationPrincipal {
    connectionId: string;
    integrationId: string;
    native: boolean;
    permissions: IntegrationPermission[];
}

const resolveManifest = (row: IntegrationConnection) => {
    if (row.native) {
        const definition = NATIVE_INTEGRATIONS.find((integration) => integration.connectionId === row.id);
        if (definition) return definition.manifest;
    }
    return parseManifest(JSON.parse(row.manifest));
};

const toConnection = (
    row: IntegrationConnection & { credential: { id: string; createdAt: Date; lastUsedAt: Date | null } | null },
) => ({
    id: row.id,
    native: row.native,
    manifest: resolveManifest(row),
    proxyConfigured: row.proxyUrl !== null,
    grantedPermissions: parsePermissions(JSON.parse(row.grantedPermissions)),
    enabled: row.enabled,
    pinned: row.pinned,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    token: row.credential
        ? {
              id: row.credential.id,
              createdAt: row.credential.createdAt.toISOString(),
              lastUsedAt: row.credential.lastUsedAt?.toISOString() ?? null,
          }
        : null,
});

// Never return credential hashes through management APIs.
const credentialSummary = { select: { id: true, createdAt: true, lastUsedAt: true } } as const;

const parseConnectionProxyUrl = (manifest: ReturnType<typeof parseManifest>, value: unknown) => {
    if (manifest.launch?.mode === 'proxied') return parseIntegrationProxyUrl(value);
    if (value !== undefined) {
        throw createAppError(
            400,
            'UNEXPECTED_INTEGRATION_PROXY_URL',
            'A private app URL can only be configured for proxied launches.',
        );
    }
    return null;
};

export const createIntegrationService = (db: PrismaClient = models) => {
    const get = async (id: string) => {
        const row = await db.integrationConnection.findUnique({
            where: { id },
            include: { credential: credentialSummary },
        });
        if (!row) throw createAppError(404, 'INTEGRATION_NOT_FOUND', 'The integration connection was not found.');
        return toConnection(row);
    };

    return {
        get,
        async ensureNativeConnections() {
            for (const integration of NATIVE_INTEGRATIONS) {
                await db.integrationConnection.upsert({
                    where: { id: integration.connectionId },
                    create: {
                        id: integration.connectionId,
                        integrationId: integration.manifest.id,
                        native: true,
                        manifest: JSON.stringify(integration.manifest),
                        grantedPermissions: JSON.stringify(integration.manifest.permissions),
                    },
                    // Keep the owner's grants, enabled state and credentials on upgrade.
                    update: {},
                });
            }
        },
        async list() {
            const rows = await db.integrationConnection.findMany({
                orderBy: [{ native: 'desc' }, { createdAt: 'asc' }],
                include: { credential: credentialSummary },
            });
            return rows.map(toConnection);
        },
        async connect(input: { manifest: unknown; grantedPermissions?: unknown; proxyUrl?: unknown }) {
            const manifest = parseManifest(input.manifest);
            if (manifest.id.startsWith('ocean-brain.'))
                throw createAppError(
                    400,
                    'RESERVED_INTEGRATION_ID',
                    'The ocean-brain namespace is reserved for native integrations.',
                );
            const grantedPermissions = validateGrants(input.grantedPermissions ?? [], manifest);
            const proxyUrl = parseConnectionProxyUrl(manifest, input.proxyUrl);
            const row = await db.integrationConnection.create({
                data: {
                    integrationId: manifest.id,
                    manifest: JSON.stringify(manifest),
                    proxyUrl,
                    grantedPermissions: JSON.stringify(grantedPermissions),
                },
                include: { credential: credentialSummary },
            });
            return toConnection(row);
        },
        async update(
            id: string,
            input: {
                manifest?: unknown;
                proxyUrl?: unknown;
                grantedPermissions?: unknown;
                enabled?: unknown;
                pinned?: unknown;
            },
        ) {
            const connection = await db.$transaction(async (tx) => {
                const current = await tx.integrationConnection.findUnique({ where: { id } });
                if (!current)
                    throw createAppError(404, 'INTEGRATION_NOT_FOUND', 'The integration connection was not found.');
                if (input.manifest !== undefined && current.native)
                    throw createAppError(
                        400,
                        'NATIVE_INTEGRATION_MANIFEST',
                        'Native integration manifests are managed by Ocean Brain.',
                    );
                for (const key of ['enabled', 'pinned'] as const) {
                    if (input[key] !== undefined && typeof input[key] !== 'boolean')
                        throw createAppError(400, 'INVALID_INTEGRATION_SETTING', `${key} must be a boolean.`);
                }
                const currentManifest = resolveManifest(current);
                const manifest = input.manifest === undefined ? currentManifest : parseManifest(input.manifest);
                if (manifest.id !== current.integrationId)
                    throw createAppError(400, 'INTEGRATION_ID_CHANGED', 'An upgrade cannot change the integration id.');
                const previousGrants = parsePermissions(JSON.parse(current.grantedPermissions)).filter((permission) =>
                    manifest.permissions.includes(permission),
                );
                const grantedPermissions = validateGrants(input.grantedPermissions ?? previousGrants, manifest);
                let proxyUrl = current.proxyUrl;
                if (manifest.launch?.mode === 'proxied') {
                    if (input.proxyUrl !== undefined) proxyUrl = parseIntegrationProxyUrl(input.proxyUrl);
                    const enteringProxiedMode =
                        input.manifest !== undefined && currentManifest.launch?.mode !== 'proxied';
                    if ((enteringProxiedMode || input.enabled === true) && !proxyUrl) {
                        throw createAppError(
                            400,
                            'INTEGRATION_PROXY_URL_REQUIRED',
                            'Configure a private app URL before enabling a proxied integration.',
                        );
                    }
                } else {
                    if (input.proxyUrl !== undefined) {
                        throw createAppError(
                            400,
                            'UNEXPECTED_INTEGRATION_PROXY_URL',
                            'A private app URL can only be configured for proxied launches.',
                        );
                    }
                    proxyUrl = null;
                }
                const row = await tx.integrationConnection.update({
                    where: { id },
                    data: {
                        manifest: JSON.stringify(manifest),
                        proxyUrl,
                        grantedPermissions: JSON.stringify(grantedPermissions),
                        ...(typeof input.enabled === 'boolean' ? { enabled: input.enabled } : {}),
                        ...(typeof input.pinned === 'boolean' ? { pinned: input.pinned } : {}),
                    },
                    include: { credential: credentialSummary },
                });
                return toConnection(row);
            });
            if (input.enabled !== undefined || input.grantedPermissions !== undefined || input.manifest !== undefined) {
                emitIntegrationAccessChanged(id);
            }
            return connection;
        },
        async disconnect(id: string) {
            const connection = await get(id);
            if (connection.native || id === MCP_CONNECTION_ID)
                throw createAppError(
                    400,
                    'NATIVE_INTEGRATION_REQUIRED',
                    'Native integrations can be disabled, but cannot be disconnected.',
                );
            await db.integrationConnection.delete({ where: { id } });
            emitIntegrationAccessChanged(id);
        },
        async rotateToken(id: string) {
            await get(id);
            const token = issueIntegrationToken();
            await db.integrationCredential.upsert({
                where: { connectionId: id },
                create: { connectionId: id, tokenHash: token.hash },
                update: { tokenHash: token.hash, createdAt: new Date(), lastUsedAt: null },
            });
            emitIntegrationAccessChanged(id);
            return { token: token.plaintext };
        },
        async revokeToken(id: string) {
            await get(id);
            await db.integrationCredential.deleteMany({ where: { connectionId: id } });
            emitIntegrationAccessChanged(id);
        },
        async authenticate(token: string): Promise<IntegrationPrincipal | null> {
            const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex');
            const credential = await db.integrationCredential.findUnique({
                where: { tokenHash },
                include: { connection: true },
            });
            if (!credential?.connection.enabled) return null;
            const connection = credential.connection;
            // Match the presented hash again: a concurrent revoke/rotation must not revive it.
            const touched = await db.integrationCredential.updateMany({
                where: { connectionId: connection.id, tokenHash },
                data: { lastUsedAt: new Date() },
            });
            if (!touched.count) return null;
            return {
                connectionId: connection.id,
                integrationId: connection.integrationId,
                native: connection.native,
                permissions: parsePermissions(JSON.parse(connection.grantedPermissions)).filter((permission) =>
                    resolveManifest(connection).permissions.includes(permission),
                ),
            };
        },
    };
};

export type IntegrationService = ReturnType<typeof createIntegrationService>;
export type IntegrationConnectionSummary = Awaited<ReturnType<IntegrationService['get']>>;
