import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { reviewAfter, reviewBefore } from './helpers/mcp-review-content';
import { collectRuntimeErrors } from './helpers/runtime-errors';

const paragraphs = Array.from(
    { length: 45 },
    (_, index) => `Paragraph ${index + 1}. A quiet place to think and write.`,
);

const reviewedContent = (page: Page) =>
    page.locator('[data-external-change]').evaluateAll((elements) =>
        elements.map((element) => {
            const copy = element.cloneNode(true) as HTMLElement;
            copy.querySelectorAll('[data-review-widget]').forEach((widget) => {
                widget.remove();
            });
            return copy.textContent;
        }),
    );

const markerFor = (page: Page, kind: 'modified' | 'added' | 'deleted') =>
    page.locator(`.note-ai-update[data-review-kind="${kind}"]`);

const openMarker = async (marker: Locator) => {
    await marker.locator('.note-ai-update__summary').click();
    await expect(marker.locator('.note-ai-update__panel')).toBeVisible();
};

const openMcpNote = async (page: Page, initialContent = paragraphs) => {
    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
    const cookies = await page.context().cookies(page.url());
    const csrf = cookies.find((cookie) => cookie.name === 'XSRF-TOKEN');
    if (!csrf) throw new Error('Missing authenticated CSRF token');
    const adminHeaders = { 'X-XSRF-TOKEN': decodeURIComponent(csrf.value) };
    const enabled = await page.request.post('/api/mcp-admin/enabled', {
        headers: adminHeaders,
        data: { enabled: true },
    });
    expect(enabled.ok()).toBe(true);
    const status = await enabled.json();
    const tokenResponse = await page.request.post('/api/mcp-admin/token/rotate', {
        headers: adminHeaders,
    });
    expect(tokenResponse.ok()).toBe(true);
    const { token } = await tokenResponse.json();
    const headers = {
        Authorization: `Bearer ${token}`,
        'X-Ocean-Brain-MCP-Compatibility-Version': status.server.mcp.compatibilityVersion,
    };
    const callMcp = async (path: string, data: Record<string, unknown>) => {
        const response = await page.request.post(`/api/mcp/notes/${path}`, {
            headers,
            data,
        });
        expect(response.ok()).toBe(true);
        return response.json();
    };
    const created = await callMcp('create', {
        title: 'MCP browser review',
        markdown: initialContent.join('\n\n'),
    });
    const id: string = created.note.id;
    const connected = page.waitForResponse((response) => response.url().endsWith('/api/events') && response.ok());
    await page.goto(`/${id}`);
    await connected;
    await expect(page.locator('.bn-editor')).toContainText(initialContent[initialContent.length - 1]);
    const replace = async (content: string[]) => {
        const baseline = await callMcp('baseline', { id });
        const result = await callMcp('replace-markdown', {
            id,
            expectedUpdatedAt: baseline.note.updatedAt,
            intent: 'Verify MCP change review in the browser',
            replacement: content.join('\n\n'),
        });
        expect(result.status).toBe('applied');
        return result;
    };
    return { replace, callMcp, id };
};

test('readers can inspect consecutive MCP edits without a modal or a scroll jump', async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    const { replace } = await openMcpNote(page);
    const localSaves: string[] = [];
    page.on('request', (request) => {
        if (request.url().endsWith('/graphql') && request.postData()?.includes('mutation UpdateNote(')) {
            localSaves.push(request.postData() ?? '');
        }
    });
    const reading = page.getByText(paragraphs[20], { exact: true });
    await reading.scrollIntoViewIfNeeded();
    const beforeTop = await reading.evaluate((element) => element.getBoundingClientRect().top);
    const updated = [...paragraphs];
    updated[2] = 'Paragraph 3. Changed through MCP.';
    updated[35] = 'Paragraph 36. Another MCP change.';

    await replace(updated);

    await expect.poll(() => reviewedContent(page)).toEqual([updated[2], updated[35]]);
    await expect(markerFor(page, 'modified')).toHaveCount(2);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByLabel('MCP changes')).toHaveCount(0);
    await expect(reading).toBeInViewport();
    expect(await reading.evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(beforeTop, 0);

    const changedContent = page
        .locator('[data-external-change="modified"] .bn-inline-content')
        .filter({ hasText: updated[2] });
    await changedContent.hover();
    const sideMenu = page.locator('.bn-side-menu');
    await expect(sideMenu).toBeVisible();
    const [changedBlockBox, sideMenuBox] = await Promise.all([
        changedContent.locator('xpath=../..').boundingBox(),
        sideMenu.boundingBox(),
    ]);
    expect(Math.abs((sideMenuBox?.y ?? 0) - (changedBlockBox?.y ?? 0))).toBeLessThanOrEqual(4);

    const firstMarker = markerFor(page, 'modified').first();
    await openMarker(firstMarker);
    await expect(firstMarker.locator('[data-review-value="before"]')).toHaveText(paragraphs[2]);
    await expect(firstMarker.locator('[data-review-value="now"]')).toHaveText(updated[2]);
    const desktopReviewLayout = await firstMarker.evaluate((element) => {
        const summary = element.querySelector<HTMLElement>('.note-ai-update__summary');
        const panel = element.querySelector<HTMLElement>('.note-ai-update__panel');
        const changedBlock = element.closest<HTMLElement>('.bn-block-outer');
        const nextBlock = changedBlock?.nextElementSibling as HTMLElement | null;
        const summaryRect = summary?.getBoundingClientRect();
        const panelRect = panel?.getBoundingClientRect();
        const changedBlockRect = changedBlock?.getBoundingClientRect();
        const nextBlockRect = nextBlock?.getBoundingClientRect();

        return {
            markerPointerEvents: getComputedStyle(element).pointerEvents,
            summaryPointerEvents: summary ? getComputedStyle(summary).pointerEvents : null,
            summaryPosition: summary ? getComputedStyle(summary).position : null,
            panelPosition: panel ? getComputedStyle(panel).position : null,
            panelBottom: panelRect?.bottom ?? 0,
            nextBlockTop: nextBlockRect?.top ?? panelRect?.bottom ?? 0,
            summaryRight: summaryRect?.right ?? 0,
            changedBlockRight: changedBlockRect?.right ?? 0,
        };
    });
    expect(desktopReviewLayout.markerPointerEvents).toBe('none');
    expect(desktopReviewLayout.summaryPointerEvents).toBe('auto');
    expect(desktopReviewLayout.summaryPosition).toBe('static');
    expect(desktopReviewLayout.panelPosition).toBe('static');
    expect(desktopReviewLayout.nextBlockTop).toBeGreaterThanOrEqual(desktopReviewLayout.panelBottom - 1);
    expect(desktopReviewLayout.summaryRight).toBeCloseTo(desktopReviewLayout.changedBlockRight, 0);

    const secondMarker = markerFor(page, 'modified').nth(1);
    await openMarker(secondMarker);
    await expect(firstMarker.locator('.note-ai-update__panel')).toBeHidden();
    await expect(secondMarker.locator('[data-review-value="before"]')).toHaveText(paragraphs[35]);
    await expect(secondMarker.locator('[data-review-value="now"]')).toHaveText(updated[35]);
    await page.screenshot({
        path: testInfo.outputPath('mcp-update-receipts.png'),
    });

    updated[12] = 'Paragraph 13. Follow-up MCP edit.';
    await replace(updated);
    await expect.poll(() => reviewedContent(page)).toEqual([updated[2], updated[12], updated[35]]);
    await expect(markerFor(page, 'modified')).toHaveCount(3);
    const followUpMarker = markerFor(page, 'modified').nth(1);
    await openMarker(followUpMarker);
    await expect(followUpMarker.getByRole('group', { name: 'This change', exact: true })).toBeVisible();
    await expect(
        followUpMarker.getByRole('group', {
            name: 'All AI changes. Already applied to this note.',
            exact: true,
        }),
    ).toBeVisible();
    await expect(followUpMarker.getByText('This change', { exact: true })).toBeVisible();
    await expect(followUpMarker.getByText('All AI changes', { exact: true })).toBeVisible();
    await expect(followUpMarker.getByText('Already applied to this note', { exact: true })).toBeVisible();
    await expect(
        followUpMarker.getByRole('button', {
            name: 'Restore all AI changes',
            exact: true,
        }),
    ).toBeVisible();
    await followUpMarker.getByRole('button', { name: 'Mark all reviewed', exact: true }).click();
    await expect(page.locator('.note-ai-update')).toHaveCount(0);
    await expect(page.locator('[data-external-change]')).toHaveCount(0);
    expect(localSaves).toEqual([]);

    await page.getByRole('textbox', { name: 'Note title' }).fill('Local edit after MCP review');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Saved');
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Local edit after MCP review');
    await expect(page.locator('.bn-editor')).toContainText(updated[12]);
    expect(errors).toEqual([]);
});

test('inserting a paragraph above the viewport preserves the text being read', async ({ page }) => {
    const { replace } = await openMcpNote(page);
    const reading = page.getByText(paragraphs[20], { exact: true });
    await reading.scrollIntoViewIfNeeded();
    const before = await reading.evaluate((element) => element.getBoundingClientRect().top);

    await replace(['A new opening paragraph', ...paragraphs]);

    await expect.poll(() => reviewedContent(page)).toEqual(['A new opening paragraph']);
    const addedMarker = markerFor(page, 'added');
    await expect(addedMarker).toHaveCount(1);
    expect(await reading.evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(before, 0);
    await openMarker(addedMarker);
    await expect(addedMarker.locator('[data-review-value="before"]')).toHaveText('—');
    await expect(addedMarker.locator('[data-review-value="now"]')).toHaveText('A new opening paragraph');
    await expect(page.getByText('Loading MCP update…')).toHaveCount(0);
});

test('a deletion-only MCP update leaves an anchored, inspectable receipt', async ({ page }) => {
    const { replace } = await openMcpNote(page);

    await replace(paragraphs.filter((_, index) => index !== 10));

    const deletedMarker = markerFor(page, 'deleted');
    await expect(deletedMarker).toHaveCount(1);
    await expect(page.locator('[data-external-change]')).toHaveCount(0);
    const [markerBox, anchorBox] = await Promise.all([
        deletedMarker.boundingBox(),
        page.getByText(paragraphs[11], { exact: true }).boundingBox(),
    ]);
    expect(markerBox?.height).toBe(0);
    expect(markerBox?.y).toBeGreaterThanOrEqual(anchorBox?.y ?? 0);
    expect(markerBox?.y).toBeLessThanOrEqual((anchorBox?.y ?? 0) + (anchorBox?.height ?? 0) + 4);
    await openMarker(deletedMarker);
    await expect(deletedMarker.locator('[data-review-value="before"]')).toHaveText(paragraphs[10]);
    await expect(deletedMarker.locator('[data-review-value="now"]')).toHaveText('Removed');
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('MCP updates preserve an unsaved local draft and require conflict resolution', async ({ page }) => {
    const { replace } = await openMcpNote(page);
    const title = page.getByRole('textbox', { name: 'Note title' });
    await title.fill('My unsaved local title');
    const updated = [...paragraphs];
    updated[0] = 'An incoming MCP edit';

    await replace(updated);

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Note title', includeHidden: true })).toHaveValue(
        'My unsaved local title',
    );
    await expect(page.locator('.bn-editor')).toContainText(paragraphs[0]);
    await expect(page.locator('.note-ai-update')).toHaveCount(0);
});

test('mixed content receipts keep the original document alignment', async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    const { replace } = await openMcpNote(page, reviewBefore);
    const originalHeading = page.locator('.bn-block-content[data-content-type="heading"]').first();
    const before = await originalHeading.boundingBox();

    await replace(reviewAfter);

    await expect.poll(() => page.locator('.note-ai-update').count()).toBeGreaterThan(0);
    const after = await originalHeading.boundingBox();
    expect(after?.x).toBe(before?.x);
    expect(after?.width).toBe(before?.width);
    await originalHeading.hover();
    const headingSideMenu = page.locator('.bn-side-menu');
    await expect(headingSideMenu).toBeVisible();
    const headingSideMenuBox = await headingSideMenu.boundingBox();
    expect(Math.abs((headingSideMenuBox?.y ?? 0) - (after?.y ?? 0))).toBeLessThanOrEqual(4);
    const longParagraph = page
        .locator('[data-external-change="modified"]')
        .filter({ hasText: '업데이트는 조용히 반영하고' });
    const overlapsChangedText = await longParagraph.evaluate((block) => {
        const text = block.querySelector('.bn-inline-content');
        const summary = block.querySelector('.note-ai-update__summary');
        if (!text || !summary) return true;
        const range = document.createRange();
        range.selectNodeContents(text);
        const summaryRect = summary.getBoundingClientRect();
        return Array.from(range.getClientRects()).some(
            (rect) =>
                rect.right > summaryRect.left &&
                rect.left < summaryRect.right &&
                rect.bottom > summaryRect.top &&
                rect.top < summaryRect.bottom,
        );
    });
    expect(overlapsChangedText).toBe(false);
    const reviewed = (await reviewedContent(page)).join('\n');
    for (const text of [
        '두 번째 실험',
        '업데이트는 조용히',
        '변경된 문단을 확인하기',
        '읽던 문장을 같은 위치에',
        '변경 내용을 쉽게',
        'keepReadingPosition: true',
        '문단 강조 + 다음 변경 보기',
        '새로 추가한 관찰',
    ]) {
        expect(reviewed).toContain(text);
    }
    await expect(markerFor(page, 'modified').first()).toBeAttached();
    await expect(markerFor(page, 'added').first()).toBeAttached();
    await expect(markerFor(page, 'deleted').first()).toBeAttached();
    const modifiedMarker = markerFor(page, 'modified').first();
    await openMarker(modifiedMarker);
    const beforeText = await modifiedMarker.locator('[data-review-value="before"]').textContent();
    const nowText = await modifiedMarker.locator('[data-review-value="now"]').textContent();
    expect(beforeText).not.toBe(nowText);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.screenshot({
        path: testInfo.outputPath('mixed-mcp-update-receipts.png'),
    });
    expect(errors).toEqual([]);
});

test('AI receipts explain edits, additions, and removals without changing stored content', async ({ page }) => {
    const before = [
        '## Departure',
        'Leave Friday at noon.',
        'Keep this paragraph.',
        'An obsolete instruction.',
        '## Next',
        'Read the plan.',
    ];
    const after = [
        '## Departure',
        'Leave Monday at night.',
        'Keep this paragraph.',
        '## Next',
        'A newly added instruction.',
        'Read the plan.',
    ];
    const { replace, callMcp, id } = await openMcpNote(page, before);
    const result = await replace(after);

    const modifiedMarker = markerFor(page, 'modified');
    const addedMarker = markerFor(page, 'added');
    const deletedMarker = markerFor(page, 'deleted');
    await expect(modifiedMarker).toHaveCount(1);
    await expect(addedMarker).toHaveCount(1);
    await expect(deletedMarker).toHaveCount(1);

    await openMarker(modifiedMarker);
    await expect(modifiedMarker.locator('[data-review-value="before"]')).toHaveText('Leave Friday at noon.');
    await expect(modifiedMarker.locator('[data-review-value="now"]')).toHaveText('Leave Monday at night.');
    await openMarker(addedMarker);
    await expect(addedMarker.locator('[data-review-value="before"]')).toHaveText('—');
    await expect(addedMarker.locator('[data-review-value="now"]')).toHaveText('A newly added instruction.');
    await openMarker(deletedMarker);
    await expect(deletedMarker.locator('[data-review-value="before"]')).toHaveText('An obsolete instruction.');
    await expect(deletedMarker.locator('[data-review-value="now"]')).toHaveText('Removed');

    const baseline = await callMcp('baseline', { id });
    expect(new Date(baseline.note.updatedAt).getTime()).toBe(new Date(result.note.updatedAt).getTime());
    await deletedMarker.getByRole('button', { name: 'Mark all reviewed', exact: true }).click();
    await expect(page.locator('[data-review-widget], [data-external-change]')).toHaveCount(0);
    await expect(page.locator('.bn-editor')).toContainText('Leave Monday at night.');
    await expect(page.locator('.bn-editor')).not.toContainText('Friday');
    await expect(page.locator('.bn-editor')).not.toContainText('obsolete');
    await page.reload();
    await expect(page.locator('.bn-editor')).toContainText('Leave Monday at night.');
    await expect(page.locator('.bn-editor')).not.toContainText('Friday');
});

test('Restore all AI changes reverts the MCP update and persists the restored document', async ({ page }) => {
    const before = ['The original opening.', 'A stable second paragraph.'];
    const after = [
        'The AI-updated opening with more detail.',
        'A stable second paragraph.',
        'A new closing paragraph.',
    ];
    const { replace } = await openMcpNote(page, before);
    await replace(after);
    const modifiedMarker = markerFor(page, 'modified');
    await expect(modifiedMarker).toHaveCount(1);
    await openMarker(modifiedMarker);
    const saved = page.waitForResponse(
        (response) =>
            response.url().endsWith('/graphql') &&
            response.request().postData()?.includes('mutation UpdateNote(') === true &&
            response.ok(),
    );

    await modifiedMarker.getByRole('button', { name: 'Restore all AI changes', exact: true }).click();

    await expect(page.locator('.note-ai-update')).toHaveCount(0);
    await expect(page.locator('.bn-editor')).toContainText(before[0]);
    await expect(page.locator('.bn-editor')).not.toContainText(after[0]);
    await saved;
    await expect(page.getByRole('status')).toContainText('Saved');
    await page.reload();
    await expect(page.locator('.bn-editor')).toContainText(before[0]);
    await expect(page.locator('.bn-editor')).not.toContainText(after[0]);
    await expect(page.locator('.bn-editor')).not.toContainText(after[2]);
});

test('mobile keeps AI receipts in the document flow without horizontal overflow', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    const before = ['Opening copy.', 'Original mobile sentence.', 'Closing copy.'];
    const after = [
        'Opening copy.',
        'Updated mobile sentence with a little more context.',
        'Closing copy.',
        'New note.',
    ];
    const { replace } = await openMcpNote(page, before);

    await replace(after);

    await expect(page.locator('html')).toHaveClass(/dark/);
    const modifiedMarker = markerFor(page, 'modified');
    await expect(modifiedMarker).toHaveCount(1);
    await modifiedMarker.scrollIntoViewIfNeeded();
    const compactLayout = await modifiedMarker.evaluate((element) => {
        const summary = element.querySelector<HTMLElement>('.note-ai-update__summary');
        return {
            markerPosition: getComputedStyle(element).position,
            summaryPosition: summary ? getComputedStyle(summary).position : null,
            summaryHeight: summary?.getBoundingClientRect().height ?? 0,
            scrollWidth: document.documentElement.scrollWidth,
            viewportWidth: innerWidth,
        };
    });
    expect(compactLayout.markerPosition).toBe('relative');
    expect(compactLayout.summaryPosition).toBe('static');
    expect(compactLayout.summaryHeight).toBeGreaterThanOrEqual(40);
    expect(compactLayout.scrollWidth).toBe(compactLayout.viewportWidth);

    await openMarker(modifiedMarker);
    const panelLayout = await modifiedMarker.locator('.note-ai-update__panel').evaluate((panel) => {
        const rect = panel.getBoundingClientRect();
        return {
            position: getComputedStyle(panel).position,
            left: rect.left,
            right: rect.right,
            background: getComputedStyle(panel).backgroundColor,
            viewportWidth: innerWidth,
        };
    });
    expect(panelLayout.position).toBe('static');
    expect(panelLayout.left).toBeGreaterThanOrEqual(0);
    expect(panelLayout.right).toBeLessThanOrEqual(panelLayout.viewportWidth);
    expect(panelLayout.background).not.toBe('rgba(0, 0, 0, 0)');
    await expect(page.getByLabel('MCP changes')).toHaveCount(0);
    await page.screenshot({
        path: testInfo.outputPath('mobile-mcp-update-receipt.png'),
    });
});
