import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { expect, test as base } from '@playwright/test';

const rootDir = process.cwd();
const SERVER_URL_PATTERN = /http server listen on (http:\/\/127\.0\.0\.1:\d+)/;
const STARTUP_TIMEOUT_MS = 120_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;
const MAX_SERVER_LOG_LENGTH = 200_000;

interface E2eServer {
    process: ChildProcess;
    url: string;
    readLogs: () => string;
}

const waitForExit = (child: ChildProcess) => {
    if (child.exitCode !== null || child.signalCode !== null) {
        return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
        child.once('exit', () => resolve());
    });
};

const stopServer = async (child: ChildProcess) => {
    if (child.exitCode !== null || child.signalCode !== null) {
        return;
    }

    child.kill('SIGTERM');
    const exited = waitForExit(child).then(() => true);
    const timedOut = new Promise<false>((resolve) => {
        setTimeout(() => resolve(false), SHUTDOWN_TIMEOUT_MS).unref();
    });

    if (await Promise.race([exited, timedOut])) {
        return;
    }

    child.kill('SIGKILL');
    await waitForExit(child);
};

const startServer = () => {
    return new Promise<E2eServer>((resolve, reject) => {
        const child = spawn(process.execPath, ['scripts/test/start-e2e-server.mjs'], {
            cwd: rootDir,
            env: {
                ...process.env,
                E2E_CLIENT_DIST: path.join(rootDir, 'packages', 'client', 'dist'),
                E2E_PORT: process.env.E2E_PORT ?? '0',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let logs = '';
        let settled = false;
        const appendLogs = (source: 'stdout' | 'stderr', chunk: Buffer) => {
            logs += `[${source}] ${chunk.toString()}`;
            if (logs.length > MAX_SERVER_LOG_LENGTH) {
                logs = logs.slice(-MAX_SERVER_LOG_LENGTH);
            }

            if (settled) {
                return;
            }

            const match = logs.match(SERVER_URL_PATTERN);
            if (match) {
                settled = true;
                clearTimeout(startupTimer);
                resolve({ process: child, url: match[1], readLogs: () => logs });
            }
        };

        child.stdout?.on('data', (chunk: Buffer) => appendLogs('stdout', chunk));
        child.stderr?.on('data', (chunk: Buffer) => appendLogs('stderr', chunk));

        const startupTimer = setTimeout(() => {
            if (settled) {
                return;
            }

            settled = true;
            void stopServer(child).finally(() => {
                reject(new Error(`E2E server did not become ready within ${STARTUP_TIMEOUT_MS}ms.\n${logs}`));
            });
        }, STARTUP_TIMEOUT_MS);

        child.once('error', (error) => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(startupTimer);
            reject(error);
        });
        child.once('exit', (code, signal) => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(startupTimer);
            reject(new Error(`E2E server exited before startup (code=${code}, signal=${signal}).\n${logs}`));
        });
    });
};

export const test = base.extend<{ e2eServer: E2eServer }>({
    e2eServer: async ({}, use, testInfo) => {
        const server = await startServer();

        try {
            await use(server);
        } finally {
            await stopServer(server.process);
            if (testInfo.status !== testInfo.expectedStatus) {
                await testInfo.attach('e2e-server.log', {
                    body: server.readLogs(),
                    contentType: 'text/plain',
                });
            }
        }
    },
    baseURL: async ({ e2eServer }, use) => {
        await use(e2eServer.url);
    },
});

export { expect };
