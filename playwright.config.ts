import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const rootDir = process.cwd();
const inheritedPort = process.env.PLAYWRIGHT_TEST_BASE_URL
    ? Number(new URL(process.env.PLAYWRIGHT_TEST_BASE_URL).port)
    : undefined;
const defaultPort = 6684 + (process.pid % 1000);
const port = Number(process.env.E2E_PORT ?? inheritedPort ?? defaultPort);
const baseURL = `http://127.0.0.1:${port}`;
const runId = (process.env.E2E_RUN_ID ?? `${Date.now()}-${process.pid}`).replace(/[^a-zA-Z0-9_-]/g, '-');

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    workers: 1,
    outputDir: path.join(rootDir, 'test-results', `e2e-${runId}`),
    expect: {
        timeout: 5_000,
    },
    use: {
        baseURL,
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'node scripts/test/start-e2e-server.mjs',
        cwd: rootDir,
        env: {
            E2E_CLIENT_DIST: path.join(rootDir, 'packages/client/dist'),
            E2E_PORT: String(port),
        },
        port,
        reuseExistingServer: false,
        gracefulShutdown: {
            signal: 'SIGTERM',
            timeout: 5_000,
        },
        timeout: 120_000,
    },
});
