import { expect, test } from '@playwright/test';

test('unauthenticated users see the login page and authenticated users load the app shell', async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => {
        pageErrors.push(error);
    });

    await page.goto('/');

    await expect(page).toHaveURL(/\/login\?next=%2F$/);
    await expect(page.getByText('Enter the workspace password to continue')).toBeVisible();
    await expect(page.locator('form[action="/login"]')).toBeVisible();

    await page.locator('input[name="password"]').fill('e2e-password');
    await page.locator('form[action="/login"]').evaluate((form: HTMLFormElement) => form.submit());

    await expect(page).toHaveURL('/');
    await expect(page.locator('#root')).not.toBeEmpty();
    await page.waitForTimeout(1000);

    expect(pageErrors).toEqual([]);
});
