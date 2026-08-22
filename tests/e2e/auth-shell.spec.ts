import { expect, test } from '@playwright/test';
import { collectRuntimeErrors } from './helpers/runtime-errors';

test('unauthenticated users see the login page and authenticated users load the app shell', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);

    await page.goto('/');

    await expect(page).toHaveURL(/\/login\?next=%2F$/);
    await expect(page.getByText('Ocean Brain')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL((url) => url.pathname === '/');
    await expect(page.locator('#root')).not.toBeEmpty();

    expect(runtimeErrors).toEqual([]);
});
