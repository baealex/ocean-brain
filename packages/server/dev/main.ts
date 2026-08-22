import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ClientContentHandler } from '../src/routes/client.js';
import { createServer as createViteServer, type ViteDevServer } from 'vite';

import { createApp, createFastifyApplication } from '../src/app.js';
import { startServer } from '../src/server.js';

const devDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(devDirectory, '../../client');

process.env.OCEAN_BRAIN_VITE_MIDDLEWARE_MODE = 'true';

let viteServer: ViteDevServer | undefined;

const createViteContentHandler = (vite: ViteDevServer): ClientContentHandler => {
    return (request, reply) => {
        reply.hijack();

        return new Promise<void>((resolve) => {
            const response = reply.raw;
            const settle = () => {
                response.off('finish', settle);
                response.off('close', settle);
                resolve();
            };

            response.on('finish', settle);
            response.on('close', settle);
            vite.middlewares(request.raw, response, (error: unknown) => {
                if (response.writableEnded) {
                    return;
                }

                response.statusCode = error ? 500 : 404;
                response.end(error instanceof Error ? error.message : undefined);
            });
        });
    };
};

try {
    await startServer({
        serverFactory: async (authConfig) => {
            const application = createFastifyApplication();

            viteServer = await createViteServer({
                root: clientRoot,
                configFile: path.join(clientRoot, 'vite.config.ts'),
                appType: 'spa',
                server: {
                    middlewareMode: { server: application.server },
                    hmr: { server: application.server },
                },
            });

            createApp(authConfig, {
                application,
                clientContentHandler: createViteContentHandler(viteServer),
            });

            return application;
        },
    });
} catch (error) {
    await viteServer?.close();

    const message = error instanceof Error ? error.message : 'Unknown development server error';
    process.stderr.write(`[dev] Startup failed: ${message}\n`);
    process.exit(1);
}
