import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from './fixtures';
import { collectRuntimeErrors } from './helpers/runtime-errors';

test('an external app preserves navigation and applies permission changes', async ({
    page,
    e2eServer,
}, testInfo) => {
    const manifest = {
        schemaVersion: 1,
        apiVersion: 1,
        id: 'test.external-app',
        name: 'Note Inbox',
        version: '1.0.0',
        description: 'External page fixture for integration management.',
        permissions: ['notes:read', 'notes:create'],
        launch: { url: 'http://127.0.0.1:7777', mode: 'iframe' },
    };
    const runtimeErrors = collectRuntimeErrors(page);
    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    await page.goto('/setting/integrations');
    await expect(page.getByRole('region', { name: 'MCP', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Connect app' }).click();
    const connect = page.getByRole('dialog', { name: 'Connect an external app' });
    const fileChooserPromise = page.waitForEvent('filechooser');
    await connect.getByLabel('App manifest file').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
        name: 'manifest.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(manifest)),
    });
    await expect(connect.getByText('manifest.json', { exact: true })).toBeVisible();
    await expect(connect.getByText('Note Inbox', { exact: true })).toBeVisible();
    await connect.getByText('Read notes', { exact: true }).click();
    await expect(connect.getByLabel('Read notes', { exact: true })).toBeChecked();
    await connect.getByRole('button', { name: 'Connect app' }).click();
    const card = page.getByRole('region', { name: 'Note Inbox', exact: true });
    await card.getByRole('button', { name: 'Generate token' }).click();
    const token = await card.getByLabel('Save this token now. It is shown only once.').inputValue();
    const app = createServer((_request, response) => {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end('<!doctype html><html lang="en"><title>External app</title><h1>Note Inbox</h1></html>');
    });
    try {
        app.listen(0, '127.0.0.1');
        await once(app, 'listening');
        const inboxUrl = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
        const createNote = () =>
            page.request.post(`${e2eServer.url}/api/integrations/v1/notes/create`, {
                headers: { authorization: `Bearer ${token}` },
                data: {
                    title: 'Integration browser contract',
                    markdown: 'Created using the approved integration grants.',
                },
            });
        manifest.launch.url = inboxUrl;
        await card.getByText('App settings', { exact: true }).click();
        await card.getByLabel('App URL', { exact: true }).fill(inboxUrl);
        await card.getByRole('button', { name: 'Update manifest', exact: true }).click();
        await expect(card.getByText(`${inboxUrl}/`, { exact: true })).toBeVisible();
        await card.getByText('App settings', { exact: true }).click();
        await card.getByRole('button', { name: 'Hide token' }).click();
        await card.getByRole('switch', { name: 'Enable Note Inbox' }).click();
        await expect(card.getByRole('switch', { name: 'Enable Note Inbox' })).toBeChecked();
        await expect(card.getByText('Waiting for first access', { exact: true })).toBeVisible();
        const reported = await page.request.post(`${e2eServer.url}/api/integrations/v1/status`, {
            headers: { authorization: `Bearer ${token}` },
            data: { state: 'failed', message: 'Publishing account disconnected. Open the app to reconnect it.' },
        });
        expect(reported.ok()).toBeTruthy();
        await page.getByRole('button', { name: 'Refresh status' }).click();
        await expect(card.getByText('Needs attention', { exact: true })).toBeVisible();
        await expect(card.getByText('Publishing account disconnected. Open the app to reconnect it.')).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('integration-status-desktop.png'), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(card.getByText('Needs attention', { exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
        await page.screenshot({ path: testInfo.outputPath('integration-status-mobile.png'), fullPage: true });
        await page.setViewportSize({ width: 1280, height: 720 });
        await card.getByRole('switch', { name: 'Show in top bar' }).click();
        const settingsUrl = page.url();
        const connectionId = new URL(settingsUrl).searchParams.get('connection');
        expect(connectionId).toBeTruthy();
        await page.reload();
        await expect(card.getByRole('button', { name: 'Configure Note Inbox' })).toHaveAttribute(
            'aria-expanded',
            'true',
        );
        const layout = await page.evaluateHandle(() => {
            const main = document.querySelector('main');
            const heading = main?.querySelector('h1')?.getBoundingClientRect();
            if (!main || !heading) throw new Error('The integration settings page is missing.');
            const headingTop = heading.y + main.scrollTop;
            const state = {
                running: true,
                frames: 0,
                appFrames: 0,
                violations: [] as string[],
            };
            const width = main.clientWidth;
            const sample = () => {
                if (!state.running) return;
                state.frames++;
                if (main.clientWidth !== width) state.violations.push('The workspace width changed.');
                const currentHeading = main.querySelector('h1');
                if (currentHeading?.textContent === 'Integrations') {
                    const bounds = currentHeading.getBoundingClientRect();
                    // History restoration and scrolling a navigation link into view may change scrollTop.
                    // Compare document positions to detect layout shifts independently of scrolling.
                    if (Math.abs(bounds.x - heading.x) > 1 || Math.abs(bounds.y + main.scrollTop - headingTop) > 1) {
                        state.violations.push('The settings heading layout changed between frames.');
                    }
                }
                const frame = main.querySelector('iframe');
                if (frame) {
                    state.appFrames++;
                    if (Math.abs(frame.getBoundingClientRect().bottom - window.innerHeight) > 1) {
                        state.violations.push('The app did not fill the workspace during navigation.');
                    }
                }
                requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
            return state;
        });
        await page
            .getByRole('navigation', { name: 'Primary navigation' })
            .getByRole('link', { name: 'Note Inbox' })
            .click();
        await expect(page).toHaveURL(/\/integrations\//);
        const integrationPath = new URL(page.url()).pathname;
        const inbox = page.frameLocator('iframe[title="Note Inbox"]');
        await expect(inbox.getByRole('heading', { name: 'Note Inbox', exact: true })).toBeVisible();
        const workspace = await page.locator('iframe[title="Note Inbox"]').evaluate((frame) => {
            const main = frame.closest('main');
            const bounds = frame.getBoundingClientRect();
            return {
                fillsRemainingHeight: Math.abs(bounds.bottom - window.innerHeight) <= 1,
                hasOuterScroll: !!main && main.scrollHeight > main.clientHeight + 1,
            };
        });
        expect(workspace).toEqual({
            fillsRemainingHeight: true,
            hasOuterScroll: false,
        });
        await page.goBack();
        await expect(page).toHaveURL(settingsUrl);
        await expect(card.getByRole('button', { name: 'Configure Note Inbox' })).toHaveAttribute(
            'aria-expanded',
            'true',
        );
        await page.goForward();
        await expect(inbox.getByRole('heading', { name: 'Note Inbox', exact: true })).toBeVisible();
        const denied = await createNote();
        expect(denied.status()).toBe(403);
        expect((await denied.json()).message).toContain('notes:create');
        await page.getByRole('link', { name: 'Manage access' }).click();
        await expect(page).toHaveURL(settingsUrl);
        await expect(card.getByRole('button', { name: 'Configure Note Inbox' })).toHaveAttribute(
            'aria-expanded',
            'true',
        );
        const measuredLayout = await layout.evaluate(async (state) => {
            await new Promise(requestAnimationFrame);
            state.running = false;
            return state;
        });
        await layout.dispose();
        expect(measuredLayout.frames).toBeGreaterThan(0);
        expect(measuredLayout.appFrames).toBeGreaterThan(0);
        expect(measuredLayout.violations).toEqual([]);
        await card.getByText('Create notes', { exact: true }).click();
        await expect(card.getByLabel('Create notes', { exact: true })).toBeChecked();
        await page.goto(integrationPath);
        await expect(inbox.getByRole('heading', { name: 'Note Inbox', exact: true })).toBeVisible();
        const created = await createNote();
        expect(created.status()).toBe(200);
        expect((await created.json()).note.title).toBe('Integration browser contract');
        await page.screenshot({
            path: testInfo.outputPath('external-integration.png'),
            fullPage: true,
        });
        await page.getByRole('link', { name: 'Manage access' }).click();
        await card.getByRole('switch', { name: 'Enable Note Inbox' }).click();
        await expect(card.getByRole('switch', { name: 'Enable Note Inbox' })).not.toBeChecked();
        await expect(
            page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Note Inbox' }),
        ).toHaveCount(0);
        expect((await createNote()).status()).toBe(403);
        expect(runtimeErrors).toEqual([]);
    } finally {
        app.closeAllConnections();
        await new Promise<void>((resolve, reject) => app.close((error) => (error ? reject(error) : resolve())));
    }
});
