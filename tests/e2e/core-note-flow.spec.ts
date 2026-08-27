import { expect, test } from './fixtures';
import { collectRuntimeErrors } from './helpers/runtime-errors';

test('users can capture, save, find, and reopen a note', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);

    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');

    await page.getByRole('button', { name: /Open a new note/ }).click();
    await expect(page).toHaveURL((url) => /^\/[^/]+$/.test(url.pathname));

    const notePath = new URL(page.url()).pathname;
    const noteTitle = 'Core flow field journal';
    const searchablePhrase = 'violet lighthouse rendezvous';
    const titleInput = page.getByRole('textbox', { name: 'Note title' });
    const editor = page.locator('.bn-editor[contenteditable="true"]');

    await titleInput.fill(noteTitle);
    await editor.click();
    await page.keyboard.type(searchablePhrase);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Saved');

    await page.getByRole('button', { name: 'Open detailed search' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/search');

    await page.getByRole('searchbox', { name: 'Search notes' }).fill(searchablePhrase);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByText('1 result', { exact: true })).toBeVisible();

    const resultLink = page.locator('main').getByRole('link', { name: noteTitle, exact: true });
    await expect(resultLink).toBeVisible();
    await resultLink.click();

    await expect(page).toHaveURL((url) => url.pathname === notePath);
    await expect(titleInput).toHaveValue(noteTitle);
    await expect(editor).toContainText(searchablePhrase);
    expect(runtimeErrors).toEqual([]);
});
