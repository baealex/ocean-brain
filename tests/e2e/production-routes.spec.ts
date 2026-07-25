import { expect, type Page, test } from '@playwright/test';

const signIn = async (page: Page) => {
    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
};

const collectRuntimeErrors = (page: Page) => {
    const errors: string[] = [];

    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error') {
            errors.push(message.text());
        }
    });

    return errors;
};

test('production note chunks render after navigation and a direct hard refresh', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await signIn(page);

    await page.getByRole('button', { name: /Open a new note/ }).click();
    await expect(page).toHaveURL((url) => /^\/[^/]+$/.test(url.pathname));
    await expect(page.getByRole('textbox', { name: 'Note title' })).toBeVisible();
    await expect(page.locator('[contenteditable="true"]').first()).toBeVisible();

    const notePath = new URL(page.url()).pathname;
    await page.getByRole('textbox', { name: 'Note title' }).fill('Production bundle smoke');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Saved');

    await page.goto(notePath);
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Production bundle smoke');
    await expect(page.locator('[contenteditable="true"]').first()).toBeVisible();
    expect(runtimeErrors).toEqual([]);
});

test('Diagram slash commands remain editable and render after a hard refresh', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await signIn(page);

    await page.getByRole('button', { name: /Open a new note/ }).click();
    await page.getByRole('textbox', { name: 'Note title' }).fill('Mermaid production smoke');

    const editor = page.locator('.bn-editor[contenteditable="true"]');
    await editor.click();
    await page.keyboard.type('/diagram');
    await page.getByText('Diagram', { exact: true }).click();

    await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible();
    const codeBlock = page.locator('[data-content-type="codeBlock"]');
    await codeBlock.locator('code').click();
    await page.keyboard.type('graph TD; A-->B');
    await page.getByRole('button', { name: 'Preview' }).click();

    const preview = page.getByLabel('Mermaid diagram preview');
    await expect(preview.locator('svg')).toBeVisible();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Saved');

    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Mermaid production smoke');
    await expect(page.getByLabel('Mermaid diagram preview').locator('svg')).toBeVisible();
    const diagramToolbar = page.getByRole('toolbar', { name: 'Diagram controls' });
    await expect(diagramToolbar).toBeVisible();
    await diagramToolbar.getByRole('button', { name: 'Edit' }).click();
    await expect(codeBlock.locator('pre')).toBeVisible();
    await expect(codeBlock.locator('code')).toContainText('graph TD; A-->B');
    expect(runtimeErrors).toEqual([]);
});

test('Math formula slash commands render accessible formulas after a hard refresh', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await signIn(page);

    await page.getByRole('button', { name: /Open a new note/ }).click();
    await page.getByRole('textbox', { name: 'Note title' }).fill('KaTeX production smoke');

    const editor = page.locator('.bn-editor[contenteditable="true"]');
    await editor.click();
    await page.keyboard.type('/math');
    await page.getByText('Math Formula', { exact: true }).click();

    await expect(page.getByRole('button', { name: 'Preview' })).toBeVisible();
    const codeBlock = page.locator('[data-content-type="codeBlock"]');
    await codeBlock.locator('code').click();
    await page.keyboard.type('E = mc^2');
    await page.getByRole('button', { name: 'Preview' }).click();

    const preview = page.getByLabel('Math formula preview');
    await expect(preview.locator('.katex')).toBeVisible();
    await expect(preview.locator('math')).toHaveCount(1);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Saved');

    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('KaTeX production smoke');
    await expect(page.getByLabel('Math formula preview').locator('.katex')).toBeVisible();
    const formulaToolbar = page.getByRole('toolbar', { name: 'Math formula controls' });
    await expect(formulaToolbar).toBeVisible();
    await formulaToolbar.getByRole('button', { name: 'Edit' }).click();
    await expect(codeBlock.locator('pre')).toBeVisible();
    await expect(codeBlock.locator('code')).toContainText('E = mc^2');
    expect(runtimeErrors).toEqual([]);
});

test('production graph chunks render after a direct hard refresh', async ({ page }) => {
    const runtimeErrors = collectRuntimeErrors(page);
    await signIn(page);

    await page.goto('/graph');
    await expect(page.getByRole('heading', { name: 'Knowledge Graph' })).toBeVisible();
    await expect(page.getByText('No constellations yet')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Knowledge Graph' })).toBeVisible();
    await expect(page.getByText('No constellations yet')).toBeVisible();
    expect(runtimeErrors).toEqual([]);
});
