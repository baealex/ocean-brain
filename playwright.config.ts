import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 6684);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
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
        command: [
            'rm -rf .tmp/e2e',
            'mkdir -p .tmp/e2e/data/assets/images',
            'rm -rf packages/server/client',
            'mkdir -p packages/server/client',
            'cp -R packages/client/dist packages/server/client/dist',
            [
                `DATABASE_URL="file:$PWD/.tmp/e2e/data/db.sqlite3"`,
                'OCEAN_BRAIN_DATA_DIR="$PWD/.tmp/e2e/data"',
                'OCEAN_BRAIN_IMAGE_DIR="$PWD/.tmp/e2e/data/assets/images"',
                'OCEAN_BRAIN_PASSWORD="e2e-password"',
                'OCEAN_BRAIN_SESSION_SECRET="e2e-session-secret-for-browser-tests"',
                'HOST="127.0.0.1"',
                `PORT="${port}"`,
                'pnpm start',
            ].join(' '),
        ].join(' && '),
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
