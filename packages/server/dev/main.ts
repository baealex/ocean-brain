import { createServer as createNodeHttpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express, { type RequestHandler } from 'express';
import { createServer as createViteServer, type ViteDevServer } from 'vite';

import { createApp } from '../src/app.js';
import { startServer } from '../src/server.js';

const devDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(devDirectory, '../../client');

process.env.OCEAN_BRAIN_VITE_MIDDLEWARE_MODE = 'true';

let viteServer: ViteDevServer | undefined;

try {
    await startServer({
        serverFactory: async (authConfig) => {
            const application = express();
            const httpServer = createNodeHttpServer(application);

            viteServer = await createViteServer({
                root: clientRoot,
                configFile: path.join(clientRoot, 'vite.config.ts'),
                appType: 'spa',
                server: {
                    middlewareMode: { server: httpServer },
                    hmr: { server: httpServer },
                },
            });

            createApp(authConfig, {
                application,
                clientContentMiddleware: viteServer.middlewares as unknown as RequestHandler,
            });

            return httpServer;
        },
    });
} catch (error) {
    await viteServer?.close();

    const message = error instanceof Error ? error.message : 'Unknown development server error';
    process.stderr.write(`[dev] Startup failed: ${message}\n`);
    process.exit(1);
}
