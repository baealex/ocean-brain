import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { collectRuntimeErrors } from './helpers/runtime-errors';

const signInOnPhone = async (page: Page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
};

const graph = async (page: Page, query: string, variables: Record<string, unknown> = {}) => {
    const csrf = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value;
    if (!csrf) throw new Error('Missing session CSRF token');
    const response = await page.request.post('/graphql', {
        headers: { 'x-xsrf-token': decodeURIComponent(csrf) },
        data: { query, variables },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    const result = await response.json();
    expect(result.errors).toBeUndefined();
    return result.data;
};

const openPlainNote = async (page: Page) => {
    const content = JSON.stringify([{ id: 'body', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Body text', styles: {} }], children: [] }]);
    const created = await graph(page, 'mutation($content: String!) { createNote(note: { title: "Plain note", content: $content }) { id } }', { content });
    const remindersLoaded = page.waitForResponse((response) => response.url().endsWith('/graphql') && Boolean(response.request().postData()?.includes('FetchNoteReminders')));
    await page.goto(`/${created.createNote.id}`);
    await expect(page.locator('.bn-editor')).toContainText('Body text');
    await remindersLoaded;
    return created.createNote.id as string;
};

test('a note without properties or reminders shows its body right under the title on a phone', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await signInOnPhone(page);

    await openPlainNote(page);

    const titleCard = await page.locator('.surface-floating', { has: page.getByRole('textbox', { name: 'Note title' }) }).boundingBox();
    const body = await page.locator('.bn-editor').boundingBox();
    if (!titleCard || !body) throw new Error('The note title or body is missing');
    expect(body.y - (titleCard.y + titleCard.height)).toBeLessThan(80);
    await expect(page.getByRole('region', { name: 'Note properties' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Reminders' })).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('a property added from the note actions saves the value typed right after choosing it', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await signInOnPhone(page);
    await graph(page, 'mutation { createNotePropertyKey(input: { key: "status", name: "Status", valueType: text }) { key } }');
    const id = await openPlainNote(page);

    await page.getByRole('button', { name: 'Note actions' }).click();
    await page.getByRole('menuitem', { name: 'Add property', exact: true }).click();
    await page.getByRole('menuitem', { name: /^Status/ }).click();
    await page.keyboard.type('Open');

    await expect(page.getByRole('region', { name: 'Note properties' }).getByRole('textbox', { name: 'Property value' })).toHaveValue('Open');
    await expect.poll(async () => (await graph(page, 'query($id: ID!) { note(id: $id) { properties { key value } } }', { id })).note.properties).toEqual([{ key: 'status', value: 'Open' }]);
    expect(errors).toEqual([]);
});

test('a reminder added from the note actions appears under the note', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await signInOnPhone(page);
    await openPlainNote(page);
    await page.getByRole('button', { name: 'Note actions' }).click();
    await page.getByRole('menuitem', { name: 'Add reminder', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Create Reminder' });
    await dialog.getByPlaceholder('Enter reminder content (optional)').fill('Call the dentist');

    await dialog.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(page.getByRole('region', { name: 'Reminders' })).toContainText('Call the dentist');
    expect(errors).toEqual([]);
});
