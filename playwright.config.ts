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
});
