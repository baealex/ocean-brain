import { createServer as createNodeHttpServer, type Server as HttpServer } from 'node:http';

import { createApp } from './app.js';
import { ensureNoteReferenceIndex } from './features/note/services/note-reference-index.js';
import { getDefaultSemanticSearchManager } from './features/search/search-manager.js';
import { type AuthConfig, logAuthConfig, resolveAuthConfig } from './modules/auth-mode.js';
import { startDataMaintenanceScheduler } from './modules/data-maintenance.js';

type ServerFactory = (authConfig: AuthConfig) => HttpServer | Promise<HttpServer>;

export type StartServerOptions = {
    serverFactory?: ServerFactory;
};

export const startServer = async (options: StartServerOptions = {}) => {
    const port = Number(process.env.PORT || 6683);
    const host = process.env.HOST || '0.0.0.0';
    const authConfig = resolveAuthConfig(process.env);

    logAuthConfig(authConfig);

    const httpServer = options.serverFactory
        ? await options.serverFactory(authConfig)
        : createNodeHttpServer(createApp(authConfig));

    getDefaultSemanticSearchManager();

    const rebuiltReferenceCount = await ensureNoteReferenceIndex();

    if (rebuiltReferenceCount > 0) {
        process.stdout.write(`[maintenance] Rebuilt ${rebuiltReferenceCount} note reference rows\n`);
    }

    httpServer.listen(port, host, () => {
        process.stdout.write(`http server listen on ${host}:${port} (auth: ${authConfig.mode})\n`);

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
    });

    return httpServer;
};
