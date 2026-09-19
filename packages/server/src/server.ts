import type { FastifyInstance } from 'fastify';

import { createApp } from './app.js';
import { ensureNoteReferenceIndex } from './features/note/services/note-reference-index.js';
import { getDefaultSemanticSearchManager } from './features/search/search-manager.js';
import { type AuthConfig, logAuthConfig, resolveAuthConfig } from './modules/auth-mode.js';
import { startDataMaintenanceScheduler } from './modules/data-maintenance.js';

type ServerFactory = (authConfig: AuthConfig) => FastifyInstance | Promise<FastifyInstance>;

export type StartServerOptions = {
    serverFactory?: ServerFactory;
};

export const startServer = async (options: StartServerOptions = {}) => {
    const port = Number(process.env.PORT || 6683);
    const host = process.env.HOST || '0.0.0.0';
    const authConfig = resolveAuthConfig(process.env);

    logAuthConfig(authConfig);

    const app = options.serverFactory ? await options.serverFactory(authConfig) : createApp(authConfig);

    getDefaultSemanticSearchManager();

    const rebuiltReferenceCount = await ensureNoteReferenceIndex();

    if (rebuiltReferenceCount > 0) {
        process.stdout.write(`[maintenance] Rebuilt ${rebuiltReferenceCount} note reference rows\n`);
    }

    const address = await app.listen({ port, host });
    process.stdout.write(`http server listen on ${address} (auth: ${authConfig.mode})\n`);

    startDataMaintenanceScheduler({
        onResults: (results) => {
            for (const result of results) {
                process.stdout.write(`[maintenance] Reconciled ${result.processedCount} rows for ${result.key}\n`);
            }
        },
        onError: (error) => {
            const message = error instanceof Error ? error.message : 'Unknown data maintenance error';
            process.stderr.write(`[maintenance] Background run failed: ${message}\n`);
        },
    });

    return app;
};
