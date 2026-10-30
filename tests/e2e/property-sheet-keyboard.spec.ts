import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { collectRuntimeErrors } from './helpers/runtime-errors';

const signIn = async (page: Page) => {
    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
};

// Desktop Chromium does not show an Android IME. Override only its reported visible
// area in this isolated test; the layout viewport and real DOM layout stay full size.
const setVisibleArea = async (page: Page, height: number, offsetTop = 0, scale = 1) => {
    await page.evaluate(({ height, offsetTop, scale }) => {
        const viewport = window.visualViewport;
        if (!viewport) throw new Error('VisualViewport is required for this browser test.');
        Object.defineProperties(viewport, {
            height: { configurable: true, value: height },
            offsetTop: { configurable: true, value: offsetTop },
            scale: { configurable: true, value: scale },
        });
        viewport.dispatchEvent(new Event('resize'));
        viewport.dispatchEvent(new Event('scroll'));
    }, { height, offsetTop, scale });
};

const expectFocusedInputVisible = async (page: Page) => {
    await expect.poll(() => page.evaluate(() => {
        const input = document.activeElement;
        const viewport = window.visualViewport;
        const dialog = input?.closest('[role="dialog"]');
        if (!(input instanceof HTMLInputElement) || !viewport || !dialog) return false;
        const bounds = input.getBoundingClientRect();
        const dialogBounds = dialog.getBoundingClientRect();
        return bounds.top >= viewport.offsetTop &&
            bounds.bottom <= viewport.offsetTop + viewport.height &&
            dialogBounds.top >= viewport.offsetTop &&
            dialogBounds.bottom <= viewport.offsetTop + viewport.height + 1;
    })).toBe(true);
    await expect(page.locator('input:focus')).toBeInViewport({ ratio: 1 });
};

test('a long select-property draft keeps later inputs above the keyboard without losing focus or values', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    await page.goto('/setting/properties');
    await page.getByRole('button', { name: 'New property', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Choice');
    await page.getByRole('combobox', { name: 'Type', exact: true }).click();
    await page.getByRole('option', { name: 'Select', exact: true }).click();
    for (let index = 1; index < 6; index++) {
        await page.getByRole('button', { name: 'Add option', exact: true }).click();
    }
    const labels = page.getByPlaceholder('Label', { exact: true });
    const values = page.getByPlaceholder('value', { exact: true });
    await labels.last().focus();
    await labels.last().fill('Last option');
    await setVisibleArea(page, 430);
    await expect(labels.last()).toBeFocused();
    await expectFocusedInputVisible(page);
    await labels.last().press('Tab');
    await expect(values.last()).toBeFocused();
    await values.last().fill('last-option');
    await expectFocusedInputVisible(page);

    // Android can pan the visible area as well as change its height.
    await setVisibleArea(page, 360, 70);
    await expect(values.last()).toBeFocused();
    await expectFocusedInputVisible(page);
    await expect(labels.last()).toHaveValue('Last option');
    await setVisibleArea(page, 844);
    await expect(values.last()).toHaveValue('last-option');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'New property', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('');
    await expect(page.getByRole('combobox', { name: 'Type', exact: true })).toContainText('Text');
    expect(errors).toEqual([]);
});

test('editing select options keeps locked values and saves a new option after keyboard navigation', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    const csrf = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value;
    if (!csrf) throw new Error('Missing session CSRF token.');
    const response = await page.request.post('/graphql', {
        headers: { 'x-xsrf-token': decodeURIComponent(csrf) },
        data: {
            query: 'mutation($input: NotePropertyDefinitionInput!) { createNotePropertyKey(input: $input) { key } }',
            variables: { input: {
                name: 'Choice', valueType: 'select',
                options: Array.from({ length: 6 }, (_, index) => ({ label: `Option ${index + 1}`, value: `option-${index + 1}` })),
            } },
        },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    const setup = await response.json();
    expect(setup.errors).toBeUndefined();
    await page.goto('/setting/properties');
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('button', { name: 'Add option', exact: true }).click();
    const label = page.getByPlaceholder('Label', { exact: true }).last();
    const value = page.getByPlaceholder('value', { exact: true });
    await label.focus();
    await label.fill('New option');
    await setVisibleArea(page, 430);
    await expectFocusedInputVisible(page);
    await label.press('Tab');
    await expect(value).toBeFocused();
    await value.fill('new-option');
    await expectFocusedInputVisible(page);
    await expect(page.getByPlaceholder('Locked value', { exact: true })).toHaveCount(6);
    await expect(page.getByPlaceholder('Locked value', { exact: true }).first()).toBeDisabled();
    await setVisibleArea(page, 844);
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.reload();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByPlaceholder('Label', { exact: true }).last()).toHaveValue('New option');
    await expect(page.getByPlaceholder('Locked value', { exact: true }).last()).toHaveValue('new-option');
    await expect(page.getByPlaceholder('Locked value', { exact: true }).first()).toHaveValue('option-1');
    expect(errors).toEqual([]);
});

test('desktop dialogs, pinch zoom and other mobile sheets retain their existing layout', async ({ page }) => {
    await signIn(page);
    await page.goto('/setting/properties');
    await page.getByRole('button', { name: 'New property', exact: true }).click();
    await page.getByRole('dialog').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    const before = await page.getByRole('dialog').boundingBox();
    await setVisibleArea(page, 430);
    await expect.poll(() => page.getByRole('dialog').boundingBox()).toEqual(before);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await setVisibleArea(page, 844);
    await page.getByRole('button', { name: 'New property', exact: true }).click();
    await page.getByRole('dialog').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    const unzoomed = await page.getByRole('dialog').boundingBox();
    await setVisibleArea(page, 430, 0, 1.5);
    await expect.poll(() => page.getByRole('dialog').boundingBox()).toEqual(unzoomed);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await setVisibleArea(page, 844);
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Views', exact: true }).click();
    await page.getByRole('button', { name: 'Create first group', exact: true }).click();
    await page.getByRole('dialog').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    const original = await page.getByRole('dialog').boundingBox();
    await setVisibleArea(page, 430);
    await expect.poll(() => page.getByRole('dialog').boundingBox()).toEqual(original);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
});
