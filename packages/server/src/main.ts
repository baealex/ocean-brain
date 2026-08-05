import { startServer } from './server.js';

startServer().catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown auth configuration error';
    process.stderr.write(`[auth] Startup failed: ${message}\n`);
    process.exit(1);
});
