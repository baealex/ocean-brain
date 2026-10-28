import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { collectRuntimeErrors } from './helpers/runtime-errors';

const graph = async (page: Page, query: string, variables: Record<string, unknown> = {}) => {
    const csrf = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value;
    if (!csrf) throw new Error('Missing session CSRF token');
    const response = await page.request.post('/graphql', { headers: { 'x-xsrf-token': decodeURIComponent(csrf) }, data: { query, variables } });
    const result = await response.json();
    expect(result.errors).toBeUndefined();
    return result.data;
};
const paragraph = (id: string, content: unknown[]) => ({ id, type: 'paragraph', content, children: [] });
const text = (text: string) => ({ type: 'text', text, styles: {} });
const link = (id: string) => ({ type: 'reference', props: { id, title: '로그인 개편' } });

const seed = async (page: Page) => {
    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
    const targets = await graph(page, `mutation {
        target: createNote(note: { title: "로그인 개편", content: "[]" }) { id }
        other: createNote(note: { title: "로그인 개편", content: "[]" }) { id }
    }`);
    const content = JSON.stringify([
        ...Array.from({ length: 18 }, (_, i) => paragraph(`agenda-${i}`, [text(`앞선 안건 ${i + 1}: 검토 내용을 정리합니다.`)])),
        paragraph('meeting-decision', [text('다른 팀의 '), link(targets.other.id), text('과 달리 '), link(targets.target.id), text('은 사용자 검증 후 다음 달에 진행한다.')]),
        ...Array.from({ length: 18 }, (_, i) => paragraph(`later-agenda-${i}`, [text(`후속 안건 ${i + 1}: 다음 회의에서 검토할 내용을 정리합니다.`)])),
    ]);
    const source = await graph(page, 'mutation($content: String!) { createNote(note: { title: "10/28 회의록", content: $content }) { id updatedAt content } }', { content });
    return { targetId: String(targets.target.id), source: source.createNote };
};

test('backlinks show the real mention and open its source block without modifying the source', async ({ page }, testInfo) => {
    // Arrange: two equally named notes, only one of which is the backlink target.
    const errors = collectRuntimeErrors(page);
    const { targetId, source } = await seed(page);
    await page.goto(`/${targetId}`);
    const references = page.getByRole('region', { name: 'Back References' });
    const excerpt = references.getByRole('link', { name: /^다른 팀의/ });
    await expect(excerpt).toContainText('사용자 검증 후 다음 달에 진행한다.');
    await expect(excerpt.locator('strong')).toHaveCount(1);
    await expect(excerpt).toHaveAttribute('href', `/${source.id}?block=meeting-decision`);
    await page.screenshot({ path: testInfo.outputPath('backlink-context.png'), fullPage: true });

    // Act: follow the excerpt to a paragraph well below the first screen.
    await excerpt.click();

    // Assert: navigation scrolls to the source block and never saves UI decorations.
    await expect(page).toHaveURL((url) => url.pathname === `/${source.id}` && url.searchParams.get('block') === 'meeting-decision');
    const block = page.locator('[data-id="meeting-decision"]').first();
    await expect(block).toBeInViewport();
    await expect.poll(async () => block.evaluate((element) => Math.abs(element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2 - window.innerHeight / 2))).toBeLessThan(60);
    await expect(block).toHaveCSS('outline-style', 'solid');
    await page.screenshot({ path: testInfo.outputPath('backlink-destination.png'), fullPage: true });
    await expect(block).not.toHaveCSS('outline-style', 'solid');
    const saved = await graph(page, 'query($id: ID!) { note(id: $id) { content updatedAt } }', { id: source.id });
    expect(saved.note).toEqual({ content: source.content, updatedAt: source.updatedAt });
    expect(errors).toEqual([]);
});

test('a removed mention block leaves its source note readable', async ({ page }) => {
    // Arrange: a valid link whose source paragraph is later removed.
    const { targetId, source } = await seed(page);
    await page.goto(`/${targetId}`);
    const excerpt = page.getByRole('region', { name: 'Back References' }).getByRole('link', { name: /^다른 팀의/ });
    const destination = await excerpt.getAttribute('href');
    expect(destination).toBeTruthy();
    await graph(page, 'mutation($id: ID!, $version: String!, $content: String!) { updateNote(id: $id, expectedUpdatedAt: $version, note: { content: $content }) { id } }', {
        id: source.id, version: source.updatedAt, content: JSON.stringify([paragraph('replacement', [text('해당 논의는 다른 회의로 옮겼습니다.')])]),
    });

    // Act: open the previously captured destination.
    await page.goto(destination ?? '/');

    // Assert: a stale block ID does not prevent reading or editing the note.
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('10/28 회의록');
    await expect(page.getByText('해당 논의는 다른 회의로 옮겼습니다.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
});
