import { expect, test } from './fixtures';
import { collectRuntimeErrors } from './helpers/runtime-errors';

const headings = Array.from({ length: 6 }, (_, index) => ({
    level: index + 1,
    text: `Heading level ${index + 1}`,
}));

test('keeps BlockNote side menu controls centered beside heading text', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');

    await page.getByRole('button', { name: /Open a new note/ }).click();
    const editor = page.locator('.bn-editor[contenteditable="true"]');
    await editor.click();
    for (const { level, text } of headings) {
        await page.keyboard.type(`${'#'.repeat(level)} ${text}`);
        await page.keyboard.press('Enter');
    }

    for (const { level, text } of headings) {
        const heading = page.getByRole('heading', { level, name: text, exact: true });
        const content = heading.locator('..');
        await content.hover();
        const sideMenu = page.locator('.bn-side-menu');
        await expect(sideMenu).toHaveAttribute('data-block-type', 'heading');
        await expect(sideMenu).toHaveAttribute('data-level', String(level));

        const alignment = await content.evaluate((element) => {
            const menu = document.querySelector<HTMLElement>('.bn-side-menu');
            const contentRect = element.getBoundingClientRect();
            const menuRect = menu?.getBoundingClientRect();
            const contentCenter = contentRect.top + contentRect.height / 2;

            return {
                contentCenter,
                contentHeight: contentRect.height,
                menuCenter: (menuRect?.top ?? 0) + (menuRect?.height ?? 0) / 2,
                menuHeight: menuRect?.height ?? 0,
                buttonCenterOffsets: Array.from(menu?.querySelectorAll('button') ?? []).map((button) => {
                    const buttonRect = button.getBoundingClientRect();
                    return Math.abs(buttonRect.top + buttonRect.height / 2 - contentCenter);
                }),
            };
        });

        expect(Math.abs(alignment.menuHeight - alignment.contentHeight)).toBeLessThanOrEqual(1);
        expect(Math.abs(alignment.menuCenter - alignment.contentCenter)).toBeLessThanOrEqual(1);
        expect(alignment.buttonCenterOffsets).toHaveLength(2);
        for (const offset of alignment.buttonCenterOffsets) {
            expect(offset).toBeLessThanOrEqual(1);
        }
    }
    expect(runtimeErrors).toEqual([]);
});
