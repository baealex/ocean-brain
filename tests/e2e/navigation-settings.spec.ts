import { expect, test } from './fixtures';
import { collectRuntimeErrors } from './helpers/runtime-errors';

test('menu layout persists mixed order and visibility, shares app pins and resets to defaults', async ({
    page,
}, testInfo) => {
    test.setTimeout(60_000);
    const errors = collectRuntimeErrors(page);
    await page.setViewportSize({ width: 1920, height: 1200 });
    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
    await page.goto('/setting');
    await page.getByRole('link', { name: 'Navigation Reorder or hide top bar menus.' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/setting/navigation');

    await page.goto('/setting/integrations');
    await expect(page.getByRole('heading', { name: 'Integrations', exact: true })).toBeVisible();
    const dimensions = await page.evaluate(() => {
        const main = document.querySelector('main');
        const root = document.querySelector('[aria-label="MCP"]');
        if (!main || !root) throw new Error('Integration settings container is missing');
        return {
            main: main.clientWidth,
            content: root.getBoundingClientRect().width,
        };
    });
    expect(dimensions.content).toBeGreaterThan(dimensions.main - 50);
    await page.screenshot({
        path: testInfo.outputPath('integrations-wide.png'),
        fullPage: true,
    });
    await page.getByRole('link', { name: 'Connect app' }).click();
    await page.getByRole('button', { name: /External app/ }).click();
    await page.getByRole('button', { name: 'Paste manifest JSON' }).click();
    await page.getByLabel('App manifest JSON').fill(
        JSON.stringify({
            schemaVersion: 1,
            apiVersion: 1,
            id: 'test.menu',
            name: 'Inbox',
            description: 'Navigation test app',
            version: '1.0.0',
            permissions: [],
            launch: { mode: 'iframe', url: 'https://example.com' },
        }),
    );
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Connect app', exact: true }).click();
    const card = page.getByRole('region', { name: 'Inbox', exact: true });
    await card.getByRole('button', { name: 'Enable connection' }).click();
    await expect(card.getByRole('switch', { name: 'Enable Inbox' })).toBeChecked();
    await card.getByRole('switch', { name: 'Show in top bar' }).click();
    await expect(card.getByRole('switch', { name: 'Show in top bar' })).toBeChecked();

    await page.goto('/setting/navigation');
    const rows = page.getByRole('list', { name: 'Top bar menus' }).getByRole('listitem');
    const searchHandle = page.getByRole('button', {
        name: 'Reorder Search',
        exact: true,
    });
    await searchHandle.focus();
    // The keyboard sensor attaches movement listeners after the activation event.
    await page.keyboard.press('Space', { delay: 50 });
    await expect(searchHandle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('status')).toContainText('droppable area core:search');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('status')).toContainText('droppable area core:notes');
    await page.keyboard.press('Space');
    await expect(rows.first()).toContainText('Notes');

    const inboxHandle = page.getByRole('button', {
        name: 'Reorder Inbox',
        exact: true,
    });
    const notesHandle = page.getByRole('button', {
        name: 'Reorder Notes',
        exact: true,
    });
    const from = await inboxHandle.boundingBox();
    const to = await notesHandle.boundingBox();
    if (!from || !to) throw new Error('Menu drag handles are missing');
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 12, { steps: 3 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
        steps: 20,
    });
    await page.mouse.up();
    await expect(rows.first()).toContainText('Inbox');
    const graphSwitch = page.getByRole('switch', { name: 'Show Graph in top bar' });
    // Pointer drags briefly suppress clicks to prevent accidental activation.
    await expect(async () => {
        if (await graphSwitch.isChecked()) await graphSwitch.click();
        await expect(graphSwitch).not.toBeChecked({ timeout: 200 });
    }).toPass();
    expect(await page.getByRole('switch', { name: 'Show Setting in top bar' }).isDisabled()).toBeTruthy();
    const savedResponse = page.waitForResponse(
        (response) => response.url().endsWith('/api/navigation-settings') && response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Save changes' }).click();
    const saved = await savedResponse;
    expect(saved.status(), await saved.text()).toBe(200);
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await page.reload();
    const navigation = page.getByRole('navigation', {
        name: 'Primary navigation',
    });
    await expect(navigation.getByRole('link').first()).toHaveText('Inbox');
    await expect(navigation.getByRole('link', { name: 'Graph', exact: true })).toHaveCount(0);
    await expect(rows.first()).toContainText('Inbox');
    await page.screenshot({
        path: testInfo.outputPath('navigation-desktop.png'),
        fullPage: true,
    });

    const inboxHref = await navigation.getByRole('link', { name: 'Inbox', exact: true }).getAttribute('href');
    if (!inboxHref) throw new Error('The Inbox navigation URL is missing');
    const connectionId = new URL(inboxHref, page.url()).pathname.split('/').at(-1);
    if (!connectionId) throw new Error('The Inbox connection ID is missing');
    await page.goto(`/setting/integrations?connection=${encodeURIComponent(connectionId)}`);
    await expect(card.getByRole('switch', { name: 'Show in top bar' })).toBeChecked();
    await card.getByRole('switch', { name: 'Show in top bar' }).click();
    await expect(card.getByRole('switch', { name: 'Show in top bar' })).not.toBeChecked();
    await page.goto('/setting/navigation');
    const pin = page.getByRole('switch', { name: 'Show Inbox in top bar' });
    await expect(pin).not.toBeChecked();
    await pin.click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await expect(navigation.getByRole('link').first()).toHaveText('Inbox');

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await inboxHandle.focus();
    await page.keyboard.press('Space', { delay: 50 });
    await expect(inboxHandle).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('status')).toContainText('droppable area core:notes');
    await page.keyboard.press('Space');
    await expect(inboxHandle).not.toHaveAttribute('aria-pressed', 'true');
    await expect(rows.first()).toContainText('Notes');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(rows.first()).toContainText('Inbox');
    await page.screenshot({
        path: testInfo.outputPath('navigation-mobile.png'),
        fullPage: true,
    });

    await page.getByRole('button', { name: 'Reset menu layout' }).click();
    await expect(page.getByRole('switch', { name: 'Show Graph in top bar' })).toBeChecked();
    await expect(navigation.getByRole('link').first()).toHaveText('Search');
    expect((await (await page.request.get('/api/navigation-settings')).json()).preferences).toBeNull();
    expect(errors).toEqual([]);
});
