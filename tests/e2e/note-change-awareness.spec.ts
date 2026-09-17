import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { collectRuntimeErrors } from './helpers/runtime-errors';

async function openMcpNote(page: Page, markdown: string) {
    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
    const csrf = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value;
    expect(csrf).toBeTruthy();
    const adminHeaders = { 'x-xsrf-token': decodeURIComponent(csrf ?? '') };
    const enabled = await page.request.post('/api/mcp-admin/enabled', {
        headers: adminHeaders,
        data: { enabled: true },
    });
    expect(enabled.ok()).toBeTruthy();
    const status = await enabled.json();
    const rotated = await page.request.post('/api/mcp-admin/token/rotate', { headers: adminHeaders });
    expect(rotated.ok()).toBeTruthy();
    const { token } = await rotated.json();
    const headers = {
        Authorization: `Bearer ${token}`,
        'X-Ocean-Brain-MCP-Compatibility-Version': status.server.mcp.compatibilityVersion,
    };
    const created = await page.request.post('/api/mcp/notes/create', {
        headers,
        data: { title: 'Change awareness', markdown },
    });
    expect(created.ok()).toBeTruthy();
    const { note } = await created.json();
    await page.goto(`/${note.id}`);
    const editor = page.locator('.bn-editor');
    await expect(editor).toBeVisible();
    return { note, headers, editor };
}

test('MCP changes appear in place without saving decorations or moving the reading position', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    const paragraphs = Array.from({ length: 25 }, (_, i) => `Unchanged paragraph ${i + 1}.`);
    const original = ['Original launch plan.', 'Remove this obsolete instruction.', ...paragraphs].join('\n\n');
    const { note, headers, editor } = await openMcpNote(page, original);
    await expect(editor).toContainText('Original launch plan.');
    await page.clock.install();
    const scrolling = page.locator('[data-layout-scroll-container]');
    // Capture the actual scrolling ancestor rather than assuming window scrolling.
    const scrollTop = await editor.evaluate((element) => {
        let parent = element.parentElement;
        while (
            parent &&
            !(parent.scrollHeight > parent.clientHeight && /auto|scroll/.test(getComputedStyle(parent).overflowY))
        )
            parent = parent.parentElement;
        if (!parent) throw new Error('Missing scroll container');
        parent.dataset.layoutScrollContainer = 'true';
        parent.scrollTop = 240;
        return parent.scrollTop;
    });
    expect(scrollTop).toBeGreaterThan(0);
    const webWrites: string[] = [];
    page.on('request', (request) => {
        if (request.url().includes('/graphql') && /mutation\s/.test(request.postData() ?? ''))
            webWrites.push(request.postData() ?? '');
    });
    const updatedPlan = `Updated launch plan. ${'This longer paragraph wraps across several lines while its highlights follow the text. '.repeat(8)}End.`;
    const replacement = [updatedPlan, ...paragraphs, 'New checklist item.'].join('\n\n');
    const updated = await page.request.post('/api/mcp/notes/replace-markdown', {
        headers,
        data: { id: note.id, expectedUpdatedAt: note.updatedAt, intent: 'Update launch plan', replacement },
    });
    expect(updated.ok()).toBeTruthy();
    await expect(editor).toContainText('Updated launch plan.');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(editor.locator('[data-external-change="modified"]')).toContainText('Updated launch plan.');
    await expect(editor.locator('[data-external-change="added"]')).toContainText('New checklist item.');
    await expect(editor).not.toContainText('Remove this obsolete instruction.');
    await expect(editor.locator('.note-change-review')).toHaveText('AI changesDone reviewing');
    await expect.poll(() => scrolling.evaluate((element) => element.scrollTop)).toBe(scrollTop);
    // Every wrapped line has its own highlight box, ending at the last glyph rather than the editor edge.
    const wrappedMark = editor.locator('[data-external-change="modified"] .note-change-text');
    const fragments = await wrappedMark.evaluate((element) => {
        const rects = [...element.getClientRects()];
        const range = document.createRange();
        range.selectNodeContents(element);
        const textRects = [...range.getClientRects()];
        return {
            count: rects.length,
            lastWidth: rects.at(-1)?.width ?? 0,
            firstWidth: rects[0]?.width ?? 0,
            lastRight: rects.at(-1)?.right ?? 0,
            textRight: textRects.at(-1)?.right ?? 0,
        };
    });
    expect(fragments.count).toBeGreaterThan(1);
    expect(fragments.lastWidth).toBeLessThan(fragments.firstWidth);
    expect(Math.abs(fragments.lastRight - fragments.textRight)).toBeLessThan(1);
    await scrolling.evaluate((element) => {
        element.scrollTop = 0;
    });
    await page.screenshot({ path: test.info().outputPath('change-awareness.png'), fullPage: true });
    const result = await updated.json();
    const nextReplacement = replacement.replace('Unchanged paragraph 1.', 'Revised first paragraph.');
    const secondUpdate = await page.request.post('/api/mcp/notes/replace-markdown', {
        headers,
        data: {
            id: note.id,
            expectedUpdatedAt: result.note.updatedAt,
            intent: 'Revise the first paragraph',
            replacement: nextReplacement,
        },
    });
    expect(secondUpdate.ok()).toBeTruthy();
    await expect(editor.locator('[data-external-change]')).toHaveCount(1);
    await expect(editor.locator('[data-external-change]')).toContainText('Revised first paragraph.');
    // Finish reviewing at the last changed paragraph, before the unchanged remainder.
    const review = editor.locator('.note-change-review');
    await expect(review).toHaveCount(1);
    await expect(review.locator('xpath=preceding-sibling::*[1]')).toContainText('Revised first paragraph.');
    await expect(review.locator('xpath=following-sibling::*[1]')).toContainText('Unchanged paragraph 2.');
    await page.clock.fastForward(60_000);
    await expect(editor.locator('[data-external-change]')).toHaveCount(1);
    await review.getByRole('button', { name: 'Done reviewing' }).click();
    await expect(editor.locator('[data-external-change]')).toHaveCount(0);
    await expect(editor.locator('.note-change-text')).toHaveCount(0);
    await expect(review).toHaveCount(0);
    await expect(editor).toContainText('Revised first paragraph.');
    const secondResult = await secondUpdate.json();
    const deletionOnly = await page.request.post('/api/mcp/notes/patch-markdown', {
        headers,
        data: {
            id: note.id,
            expectedUpdatedAt: secondResult.note.updatedAt,
            intent: 'Remove an obsolete paragraph',
            selector: { type: 'exact_text', text: 'Unchanged paragraph 2.' },
            operation: { type: 'replace', replacement: '' },
        },
    });
    expect(deletionOnly.ok()).toBeTruthy();
    await expect(editor).not.toContainText('Unchanged paragraph 2.');
    await expect(editor.locator('[data-external-change]')).toHaveCount(0);
    await expect(review).toHaveCount(0);
    expect(webWrites).toEqual([]);
    expect(errors).toEqual([]);
});

for (const colorScheme of ['light', 'dark'] as const) {
    test(`highlights rich blocks without marking unchanged nested text in ${colorScheme} mode`, async ({ page }) => {
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        const original = [
            '# Old heading',
            '> Old quote',
            'Old paragraph with **bold text**.',
            '- Old bullet\n  - Unchanged child',
            '- [ ] Old task',
            '1. Old numbered item',
            'Unchanged ending.',
        ].join('\n\n');
        const { note, headers, editor } = await openMcpNote(page, original);
        const updated = await page.request.post('/api/mcp/notes/replace-markdown', {
            headers,
            data: {
                id: note.id,
                expectedUpdatedAt: note.updatedAt,
                intent: 'Revise rich blocks',
                replacement: original.replaceAll('Old', 'Updated').replace('- [ ]', '- [x]'),
            },
        });
        expect(updated.ok()).toBeTruthy();

        await expect(editor.locator('[data-external-change]')).toHaveCount(6);
        for (const text of [
            'Updated heading',
            'Updated quote',
            'Updated paragraph with ',
            'Updated bullet',
            'Updated task',
            'Updated numbered item',
        ]) {
            const mark = editor.locator('.note-change-text').filter({ hasText: text });
            await expect(mark).toBeVisible();
            await expect(mark).toHaveCSS('animation-name', 'none');
            await expect(mark).not.toHaveCSS('background-image', 'none');
        }
        await expect(editor.getByText('Unchanged child', { exact: true })).toBeVisible();
        await expect(editor.locator('.note-change-text').filter({ hasText: 'Unchanged child' })).toHaveCount(0);
        await expect(editor.locator('.note-change-text').filter({ hasText: 'Unchanged ending.' })).toHaveCount(0);
        await expect(editor.locator('.note-change-review').locator('xpath=following-sibling::*[1]')).toContainText(
            'Unchanged ending.',
        );
        await page.screenshot({ path: test.info().outputPath(`rich-changes-${colorScheme}.png`), fullPage: true });
        const done = editor.getByRole('button', { name: 'Done reviewing' });
        await done.focus();
        await page.keyboard.press('Enter');
        await expect(editor.locator('.note-change-text')).toHaveCount(0);
    });
}

for (const format of ['html', 'md'] as const) {
    test(`excludes review decorations from ${format} downloads`, async ({ page }) => {
        const { note, headers, editor } = await openMcpNote(page, 'Original paragraph.');
        const updated = await page.request.post('/api/mcp/notes/replace-markdown', {
            headers,
            data: {
                id: note.id,
                expectedUpdatedAt: note.updatedAt,
                intent: 'Revise paragraph',
                replacement: 'Updated paragraph.',
            },
        });
        expect(updated.ok()).toBeTruthy();
        await expect(editor.getByRole('button', { name: 'Done reviewing' })).toBeVisible();

        await page.getByRole('button', { name: 'Note actions' }).click();
        await page.getByRole('menuitem', { name: 'Download document' }).click();
        await page.getByRole('radio', { name: `.${format}`, exact: true }).check();
        await page.getByText('Include local image assets', { exact: true }).click();
        await expect(page.getByRole('checkbox', { name: 'Include local image assets', exact: true })).not.toBeChecked();
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: `Download .${format}`, exact: true }).click();
        const download = await downloadPromise;
        const downloadPath = await download.path();
        expect(downloadPath).toBeTruthy();
        const exported = await readFile(downloadPath!, 'utf8');

        expect(exported).toContain('Updated paragraph.');
        expect(exported).not.toMatch(/AI changes|Done reviewing|note-change-|data-external-change/);
        await expect(editor.getByRole('button', { name: 'Done reviewing' })).toBeVisible();
    });
}
