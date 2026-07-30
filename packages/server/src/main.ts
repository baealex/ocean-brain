import { createApp } from './app.js';
import { ensureNoteReferenceIndex } from './features/note/services/note-reference-index.js';
import { getDefaultSemanticSearchManager } from './features/search/search-manager.js';
import { logAuthConfig, resolveAuthConfig } from './modules/auth-mode.js';
import { startDataMaintenanceScheduler } from './modules/data-maintenance.js';

const PORT = Number(process.env.PORT || 6683);
const HOST = process.env.HOST || '0.0.0.0';

const startServer = async () => {
    const authConfig = resolveAuthConfig(process.env);

    logAuthConfig(authConfig);

    const app = createApp(authConfig);
    getDefaultSemanticSearchManager();

    const rebuiltReferenceCount = await ensureNoteReferenceIndex();

    if (rebuiltReferenceCount > 0) {
        process.stdout.write(`[maintenance] Rebuilt ${rebuiltReferenceCount} note reference rows\n`);
    }

    app.listen(PORT, HOST, () => {
        process.stdout.write(`http server listen on ${HOST}:${PORT} (auth: ${authConfig.mode})\n`);

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
};

startServer().catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown auth configuration error';
    process.stderr.write(`[auth] Startup failed: ${message}\n`);
    process.exit(1);
});
