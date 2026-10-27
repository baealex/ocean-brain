import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { collectRuntimeErrors } from './helpers/runtime-errors';

async function graph(page: Page, query: string, variables: Record<string, unknown> = {}) {
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
}

async function openSavedTable(page: Page) {
    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
    const setup = await graph(page, `mutation {
        group: createViewGroup(title: "Research") { id }
        source: createNotePropertyKey(input: { key: "source", name: "Source", valueType: url }) { key }
        priority: createNotePropertyKey(input: { key: "priority", name: "Priority", valueType: number }) { key }
        alpha: createNote(note: { title: "Alpha", content: "[]" }) { id }
        zulu: createNote(note: { title: "Zulu", content: "[]" }) { id }
    }`);
    const result = await graph(page, `mutation($groupId: ID!) {
        createView(groupId: $groupId, input: {
            title: "Reading queue", displayType: table,
            displayOptions: { tableColumns: [title, properties, updatedAt], tablePropertyKeys: ["source", "priority"] },
            propertyFilters: [{ key: "priority", valueType: number, operator: notExists }],
            sortBy: createdAt, sortOrder: desc, limit: 5
        }) { id }
    }`, { groupId: setup.group.id });
    await page.goto('/views');
    await expect(page.getByRole('table')).toBeVisible();
    return result.createView.id;
}

test('a temporary sort can become the saved default without losing the view settings', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    const viewId = await openSavedTable(page);
    const sort = page.getByRole('group', { name: 'Reading queue sort' });

    await sort.getByRole('button', { name: 'Sort: Newest notes first' }).click();
    await page.getByRole('menuitemradio', { name: 'Title: Z to A' }).click();
    await sort.getByRole('button', { name: 'Save default sort' }).click();
    await expect(sort.getByRole('button', { name: 'Save default sort' })).toHaveCount(0);
    await page.goto('/views');

    await expect(sort.getByRole('button', { name: 'Sort: Title: Z to A' })).toBeVisible();
    await expect(page.getByRole('table').getByRole('link').first()).toHaveText('Zulu');
    const saved = await graph(page, `query($id: ID!) {
        view(id: $id) {
            title displayType sortBy sortOrder limit
            propertyFilters { key operator }
            displayOptions { tableColumns tablePropertyKeys }
        }
    }`, { id: viewId });
    expect(saved.view).toEqual({
        title: 'Reading queue', displayType: 'table', sortBy: 'title', sortOrder: 'desc', limit: 5,
        propertyFilters: [{ key: 'priority', operator: 'notExists' }],
        displayOptions: { tableColumns: ['title', 'properties', 'updatedAt'], tablePropertyKeys: ['source', 'priority'] },
    });
    expect(errors).toEqual([]);
});

test('table column and property order survive saving and reloading', async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    await openSavedTable(page);

    await page.getByRole('button', { name: 'Columns', exact: true }).click();
    const titleHandle = page.getByRole('button', { name: 'Reorder Title column' });
    await titleHandle.focus();
    await page.keyboard.press('Space', { delay: 50 });
    await expect(titleHandle).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('status').filter({ hasText: 'droppable area properties' })).toHaveCount(1);
    await page.keyboard.press('Space');
    const priorityHandle = page.getByRole('button', { name: 'Reorder Priority column' });
    await priorityHandle.focus();
    await page.keyboard.press('Space', { delay: 50 });
    await expect(priorityHandle).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('status').filter({ hasText: 'droppable area source' })).toHaveCount(1);
    await page.keyboard.press('Space');
    await page.screenshot({ path: testInfo.outputPath('column-settings.png'), fullPage: true });
    await page.getByRole('button', { name: 'Save columns', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.reload();

    const headers = page.getByRole('table').getByRole('columnheader');
    await expect(headers).toHaveCount(4);
    await expect(headers.nth(0)).toContainText('Priority');
    await expect(headers.nth(1)).toContainText('Source');
    await expect(headers.nth(2)).toContainText('Title');
    await expect(headers.nth(3)).toContainText('Updated');
    await expect(page.getByRole('link', { name: 'Alpha', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('saved-table.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: 'Sort: Newest notes first' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Columns', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('saved-table-mobile.png'), fullPage: true });
    expect(errors).toEqual([]);
});

test('dragging over an expanded property group previews the new order before saving', async ({ page }) => {
    await openSavedTable(page);
    await page.getByRole('button', { name: 'Columns', exact: true }).click();
    const titleHandle = page.getByRole('button', { name: 'Reorder Title column' });
    const propertiesHandle = page.getByRole('button', { name: 'Reorder Properties column' });
    const titleRow = titleHandle.locator('xpath=ancestor::li[1]');
    const propertiesRow = propertiesHandle.locator('xpath=ancestor::li[1]');
    const titleSize = await titleRow.boundingBox();
    const propertiesSize = await propertiesRow.boundingBox();
    const from = await titleHandle.boundingBox();
    const to = await propertiesHandle.boundingBox();
    if (!from || !to) throw new Error('Column drag handles are missing');
    if (!titleSize || !propertiesSize) throw new Error('Column rows are missing');

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 10, { steps: 3 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
    await expect(page.getByRole('status').filter({ hasText: 'droppable area properties' })).toHaveCount(1);
    // Reordering a short row over an expanded group must not scale either row.
    await expect.poll(async () => (await titleRow.boundingBox())?.height).toBeCloseTo(titleSize.height, 1);
    await expect.poll(async () => (await propertiesRow.boundingBox())?.height).toBeCloseTo(propertiesSize.height, 1);
    await page.mouse.up();

    await expect(page.getByRole('list', { name: 'Column order preview' }).getByRole('listitem')).toHaveText(['Source', 'Priority', 'Title', 'Updated']);
    // Drag completion briefly suppresses pointer clicks. Escape cancels the draft immediately.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('table').getByRole('columnheader').first()).toContainText('Title');
});

test('an existing view bookmark preserves selection and upgrades its URL on the next interaction', async ({ page }) => {
    const viewId = await openSavedTable(page);
    const legacy = await graph(page, `query($id: ID!) { viewSection(id: $id) { tabId } }`, { id: viewId });
    const bookmark = new URLSearchParams({
        tab: JSON.stringify(legacy.viewSection.tabId),
        state: JSON.stringify({ version: 1, sections: { [viewId]: { sort: { by: 'title', order: 'desc' } } } }),
    });
    await page.goto(`/views?${bookmark}`);
    const sort = page.getByRole('group', { name: 'Reading queue sort' });
    await expect(sort.getByRole('button', { name: 'Sort: Title: Z to A' })).toBeVisible();
    await expect(page.getByRole('table').getByRole('link').first()).toHaveText('Zulu');

    await sort.getByRole('button', { name: 'Sort: Title: Z to A' }).click();
    await page.getByRole('menuitemradio', { name: 'Title: A to Z' }).click();

    await expect(page).toHaveURL((url) => url.searchParams.has('group') && !url.searchParams.has('tab'));
    const state = JSON.parse(new URL(page.url()).searchParams.get('state') ?? 'null');
    expect(state).toEqual({ version: 2, views: { [viewId]: { sort: { by: 'title', order: 'asc' } } } });
    await page.reload();
    await expect(page.getByRole('table').getByRole('link').first()).toHaveText('Alpha');
});
