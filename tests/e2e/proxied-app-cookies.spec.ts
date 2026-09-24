import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from './fixtures';

test.use({ launchOptions: { args: ['--test-third-party-cookie-phaseout'] } });

test('a proxied app loads with third-party cookies blocked while preserving its sandbox', async ({
    page,
    context,
}) => {
    const forwardedCredentials: string[] = [];
    const target = createServer((request, response) => {
        for (const name of ['cookie', 'authorization', 'x-ocean-brain-app-access']) {
            if (request.headers[name]) forwardedCredentials.push(name);
        }
        if (request.url === '/app.js') {
            response.writeHead(200, { 'content-type': 'application/javascript' });
            response.end(`
                document.querySelector('h1').textContent = 'App loaded';
                try { window.parent.document.body; }
                catch { document.querySelector('p').textContent = 'Host access blocked'; }
                window.parent.postMessage({ type: 'ocean-brain:app-ready', version: 1 }, '*');
            `);
            return;
        }
        if (request.url === '/app.css') {
            response.writeHead(200, { 'content-type': 'text/css' });
            response.end('h1 { color: rgb(12, 34, 56); }');
            return;
        }
        response.writeHead(200, { 'content-type': 'text/html' });
        response.end(`<!doctype html><html lang="en"><title>Cookie test</title>
            <link rel="stylesheet" href="./app.css" crossorigin="use-credentials">
            <script type="module" src="./app.js" crossorigin="use-credentials"></script>
            <h1>Loading app</h1><p>Checking sandbox</p></html>`);
    });

    try {
        target.listen(0, '127.0.0.1');
        await once(target, 'listening');
        const appUrl = `http://127.0.0.1:${(target.address() as AddressInfo).port}`;
        await page.goto('/');
        await page.getByLabel('Password').fill('e2e-password');
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
        await page.goto('/setting/integrations');
        await page.getByRole('link', { name: 'Connect app' }).click();
        await page.getByRole('button', { name: /External app/ }).click();
        const dialog = page;
        await dialog.getByText('Paste manifest JSON').click();
        await dialog.getByLabel('App manifest JSON').fill(
            JSON.stringify({
                schemaVersion: 1,
                apiVersion: 1,
                id: 'test.proxied-cookies',
                name: 'Cookie test',
                version: '1.0.0',
                description: 'Verify sandboxed assets with third-party cookies blocked.',
                permissions: [],
                launch: { mode: 'proxied' },
            }),
        );
        await page.getByRole('button', { name: 'Continue' }).click();
        await dialog.getByLabel('Private app URL').fill(appUrl);
        await dialog.getByRole('button', { name: 'Connect app' }).click();
        const card = page.getByRole('region', { name: 'Cookie test', exact: true });
        await card.getByRole('button', { name: 'Enable connection' }).click();
        await card.getByRole('link', { name: 'Open app' }).click();
        const session = await context.newCDPSession(page);
        await session.send('Network.enable');
        await session.send('Network.setCookieControls', {
            enableThirdPartyCookieRestriction: true,
        });
        await page.reload();

        const app = page.frameLocator('iframe[title="Cookie test"]');
        await expect(app.getByRole('heading', { name: 'App loaded' })).toBeVisible();
        await expect(app.getByRole('heading', { name: 'App loaded' })).toHaveCSS('color', 'rgb(12, 34, 56)');
        await expect(app.getByText('Host access blocked')).toBeVisible();
        expect(forwardedCredentials).toEqual([]);
    } finally {
        target.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
            target.close((error) => (error ? reject(error) : resolve())),
        );
    }
});
