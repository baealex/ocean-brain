import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { collectRuntimeErrors } from './helpers/runtime-errors';

const signIn = async (page: Page) => {
    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
};

test('leaving a captured note without writing leaves no note behind', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await signIn(page);
    await page.getByRole('button', { name: /Open a new note/ }).click();
    await expect(page.getByRole('textbox', { name: 'Note title' })).toBeFocused();

    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Notes' }).click();

    await expect(page.getByText('Capture anything and make waves in the ocean!')).toBeVisible();
    expect(runtimeErrors).toEqual([]);
});

test('typing continues in the same editor when the first save creates the note', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    const editor = page.locator('.bn-editor[contenteditable="true"]');
    await signIn(page);
    await page.getByRole('button', { name: /Open a new note/ }).click();
    await expect(page.getByRole('textbox', { name: 'Note title' })).toBeFocused();
    await page.keyboard.type('Uninterrupted note');
    await page.keyboard.press('Enter');
    await page.keyboard.type('First line');
    await expect(page).toHaveURL((url) => /^\/[^/]+$/.test(url.pathname) && url.pathname !== '/new');

    await page.keyboard.type(' keeps going');

    await expect(editor).toContainText('First line keeps going');
    expect(runtimeErrors).toEqual([]);
});
