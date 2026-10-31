import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { collectRuntimeErrors } from './helpers/runtime-errors';

const PHONE_VIEWPORT = { width: 390, height: 844 };

const signIn = async (page: Page) => {
    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
};

const typeNoteText = async (page: Page) => {
    await page.goto('/new');
    const editor = page.locator('.bn-editor[contenteditable="true"]');
    await editor.click();
    await page.keyboard.type('Phone sized note');

    return editor.getByText('Phone sized note').evaluate((element) => element.getBoundingClientRect().left);
};

const hasCoarsePointer = (page: Page) => page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);

test.describe('touch phone', () => {
    test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

    test('home settings stay collapsed until the display settings control is pressed', async ({ page }) => {
        const runtimeErrors = collectRuntimeErrors(page);
        await signIn(page);
        await expect(page.getByText('Pinned First')).toBeHidden();

        await page.getByRole('button', { name: 'Display settings' }).click();

        await expect(page.getByText('Pinned First')).toBeVisible();
        expect(runtimeErrors).toEqual([]);
    });

    test('note text starts close to the left edge', async ({ page }) => {
        const runtimeErrors = collectRuntimeErrors(page);
        await signIn(page);
        await page.goto('/new');
        expect(await hasCoarsePointer(page)).toBe(true);

        const left = await typeNoteText(page);

        expect(left).toBeGreaterThanOrEqual(8);
        expect(left).toBeLessThanOrEqual(32);
        expect(runtimeErrors).toEqual([]);
    });
});

test.describe('narrow window with a mouse', () => {
    test.use({ viewport: PHONE_VIEWPORT });

    test('note text keeps the side menu gutter', async ({ page }) => {
        const runtimeErrors = collectRuntimeErrors(page);
        await signIn(page);
        await page.goto('/new');
        expect(await hasCoarsePointer(page)).toBe(false);

        const left = await typeNoteText(page);

        expect(left).toBeGreaterThanOrEqual(54);
        expect(runtimeErrors).toEqual([]);
    });
});
