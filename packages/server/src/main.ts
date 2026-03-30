import { createApp } from './app.js';
import { logAuthConfig, resolveAuthConfig } from './modules/auth-mode.js';

const PORT = Number(process.env.PORT || 6683);
const HOST = process.env.HOST || '0.0.0.0';

try {
    const authConfig = resolveAuthConfig(process.env);

    logAuthConfig(authConfig);

    const app = createApp(authConfig);

    app.listen(PORT, HOST, () => {
        process.stdout.write(`http server listen on ${HOST}:${PORT} (auth: ${authConfig.mode})\n`);
    });
} catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown auth configuration error';
    process.stderr.write(`[auth] Startup failed: ${message}\n`);
    process.exit(1);
}
