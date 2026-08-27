import type { Page } from '@playwright/test';
import { collectRuntimeErrors } from './helpers/runtime-errors';
import { expect, test } from './fixtures';

const ISOLATION_NOTE_TITLE = 'E2E isolation sentinel';
const ISOLATION_SEARCH_PHRASE = 'cobalt tide isolation sentinel';

const signIn = async (page: Page) => {
    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
};

test.describe.serial('test environment isolation', () => {
    test('a browser test can persist a note inside its own environment', async ({ page }) => {
        const runtimeErrors = collectRuntimeErrors(page);
        await signIn(page);

        await page.getByRole('button', { name: /Open a new note/ }).click();
        await page.getByRole('textbox', { name: 'Note title' }).fill(ISOLATION_NOTE_TITLE);
        await page.locator('.bn-editor[contenteditable="true"]').fill(ISOLATION_SEARCH_PHRASE);
        await page.getByRole('button', { name: 'Save', exact: true }).click();

        await expect(page.getByRole('status')).toContainText('Saved');
        expect(runtimeErrors).toEqual([]);
    });

    test('the next browser test cannot observe the previous test note', async ({ page }) => {
        const runtimeErrors = collectRuntimeErrors(page);
        await signIn(page);

        await page.getByRole('button', { name: 'Open detailed search' }).click();
        await page.getByRole('searchbox', { name: 'Search notes' }).fill(ISOLATION_SEARCH_PHRASE);
        await page.getByRole('button', { name: 'Search', exact: true }).click();

        await expect(page.getByText('0 results', { exact: true })).toBeVisible();
        expect(runtimeErrors).toEqual([]);
    });
});
