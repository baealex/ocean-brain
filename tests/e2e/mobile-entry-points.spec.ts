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

const openSavedNote = async (page: Page) => {
    const csrf = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value;
    if (!csrf) throw new Error('Missing session CSRF token');
    const response = await page.request.post('/graphql', {
        headers: { 'x-xsrf-token': decodeURIComponent(csrf) },
        data: { query: 'mutation { createNote(note: { title: "Groceries", content: "[]" }) { id } }' },
    });
    const result = await response.json();
    expect(result.errors).toBeUndefined();
    await page.goto(`/${result.data.createNote.id}`);
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Groceries');
};

const captureButton = (page: Page) => page.getByRole('button', { name: 'Capture a new note' });
const editor = (page: Page) => page.locator('.bn-editor[contenteditable="true"]');

test('one tap on the mobile notes list opens a new note ready for its title', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await signIn(page);

    await captureButton(page).click();

    await expect(page).toHaveURL((url) => url.pathname === '/new');
    await expect(page.getByRole('textbox', { name: 'Note title' })).toBeFocused();
    expect(runtimeErrors).toEqual([]);
});

test('the mobile capture button steps aside while the slash menu is open in a note', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await signIn(page);
    await openSavedNote(page);
    await expect(captureButton(page)).toBeVisible();

    await editor(page).click();
    await page.keyboard.type('/');

    await expect(page.getByText('Heading 1', { exact: true })).toBeVisible();
    await expect(captureButton(page)).toBeHidden();
    expect(runtimeErrors).toEqual([]);
});

test('the mobile capture button returns once the note body loses focus', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await signIn(page);
    await openSavedNote(page);
    await editor(page).click();
    await expect(captureButton(page)).toBeHidden();

    await page.getByText('Properties', { exact: true }).click();

    await expect(captureButton(page)).toBeVisible();
    expect(runtimeErrors).toEqual([]);
});

test('a note reopened from a far tab on mobile keeps the Search tab in view', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
    await signIn(page);
    await openSavedNote(page);
    await navigation.getByRole('link', { name: 'Tags' }).click();
    await expect(navigation.getByRole('link', { name: 'Search' })).not.toBeInViewport();

    await page.goBack();

    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Groceries');
    await expect(navigation.getByRole('link', { name: 'Search' })).toBeInViewport({ ratio: 1 });
    expect(runtimeErrors).toEqual([]);
});
