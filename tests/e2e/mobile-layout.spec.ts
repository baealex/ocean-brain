import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { collectRuntimeErrors } from './helpers/runtime-errors';

test.use({ viewport: { width: 390, height: 844 } });

const signIn = async (page: Page) => {
    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
};

test('home settings stay collapsed on a phone until the display settings control is pressed', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await signIn(page);
    await expect(page.getByText('Pinned First')).toBeHidden();

    await page.getByRole('button', { name: 'Display settings' }).click();

    await expect(page.getByText('Pinned First')).toBeVisible();
    expect(runtimeErrors).toEqual([]);
});

test('note text starts close to the left edge on a phone', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await signIn(page);
    await page.goto('/new');
    const editor = page.locator('.bn-editor[contenteditable="true"]');
    await editor.click();
    await page.keyboard.type('Phone sized note');

    const paragraph = editor.getByText('Phone sized note');
    const left = await paragraph.evaluate((element) => element.getBoundingClientRect().left);

    expect(left).toBeGreaterThanOrEqual(8);
    expect(left).toBeLessThanOrEqual(32);
    expect(runtimeErrors).toEqual([]);
});
