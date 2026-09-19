import models from '~/models.js';
import { parseManifest } from '../integration/manifest.js';
import type { AppGatewayOptions } from './gateway.js';

interface ProxiedConnectionRecord {
    id: string;
    integrationId: string;
    manifest: string;
    proxyUrl: string | null;
    enabled: boolean;
}

type FindConnection = (connectionId: string) => Promise<ProxiedConnectionRecord | null>;

const findConnection: FindConnection = (connectionId) =>
    models.integrationConnection.findUnique({ where: { id: connectionId } });

export const createDatabaseAppGatewayOptions = (lookup: FindConnection = findConnection): AppGatewayOptions => ({
    resolveConnection: async (connectionId) => {
        const connection = await lookup(connectionId);
        if (!connection) return null;
        const manifest = parseManifest(JSON.parse(connection.manifest));
        if (manifest.launch?.mode !== 'proxied') return null;
        return {
            id: connection.id,
            integrationId: connection.integrationId,
            enabled: connection.enabled,
            proxyUrl: connection.proxyUrl,
        };
    },
});
