import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const rootDir = process.cwd();
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
            E2E_PORT: process.env.E2E_PORT ?? '0',
        },
        wait: {
            stdout: /http server listen on (?<playwright_test_base_url>http:\/\/127\.0\.0\.1:\d+)/,
        },
        gracefulShutdown: {
            signal: 'SIGTERM',
            timeout: 5_000,
        },
        timeout: 120_000,
    },
});
