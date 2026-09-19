import models from '~/models.js';
import { parseManifest } from '../integration/manifest.js';
import type { AppGatewayOptions } from './gateway.js';

const RUNNER_ORIGIN_ENV = 'OCEAN_BRAIN_APP_RUNNER_ORIGIN';
const RUNNER_TOKEN_ENV = 'OCEAN_BRAIN_APP_RUNNER_TOKEN';

interface ManagedConnectionRecord {
    id: string;
    integrationId: string;
    manifest: string;
    enabled: boolean;
}

type FindConnection = (installationId: string) => Promise<ManagedConnectionRecord | null>;

const findConnection: FindConnection = (installationId) =>
    models.integrationConnection.findUnique({ where: { id: installationId } });

export const createEnvironmentAppGatewayOptions = (
    environment: NodeJS.ProcessEnv = process.env,
    lookup: FindConnection = findConnection,
): AppGatewayOptions | undefined => {
    const runnerOrigin = environment[RUNNER_ORIGIN_ENV]?.trim();
    const runnerToken = environment[RUNNER_TOKEN_ENV]?.trim();
    if (!runnerOrigin && !runnerToken) return undefined;
    if (!runnerOrigin || !runnerToken) {
        throw new Error(`${RUNNER_ORIGIN_ENV} and ${RUNNER_TOKEN_ENV} must be configured together.`);
    }

    return {
        runnerOrigin,
        runnerToken,
        resolveInstallation: async (installationId) => {
            const connection = await lookup(installationId);
            if (!connection) return null;
            const manifest = parseManifest(JSON.parse(connection.manifest));
            if (manifest.launch?.mode !== 'managed') return null;
            return {
                id: connection.id,
                appId: connection.integrationId,
                enabled: connection.enabled,
            };
        },
    };
};
