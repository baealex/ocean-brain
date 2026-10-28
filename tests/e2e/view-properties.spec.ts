import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { collectRuntimeErrors } from './helpers/runtime-errors';

const graph = async (page: Page, query: string, variables: Record<string, unknown> = {}) => {
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
};

const setupTable = async (page: Page) => {
    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
    const setup = await graph(page, `mutation {
        group: createViewGroup(title: "Project") { id }
        note: createNote(note: { title: "Review release", content: "[]" }) { id updatedAt }
        state: createNotePropertyKey(input: { key: "state", name: "State", valueType: select, options: [
            { label: "Todo", value: "todo" }, { label: "Doing", value: "doing" }
        ] }) { key }
        priority: createNotePropertyKey(input: { key: "priority", name: "Priority", valueType: number }) { key }
        done: createNotePropertyKey(input: { key: "done", name: "Done", valueType: boolean }) { key }
        due: createNotePropertyKey(input: { key: "due", name: "Due", valueType: date }) { key }
        summary: createNotePropertyKey(input: { key: "summary", name: "Summary", valueType: text }) { key }
        source: createNotePropertyKey(input: { key: "source", name: "Source", valueType: url }) { key }
    }`);
    const result = await graph(page, `mutation($id: ID!, $version: String!, $groupId: ID!) {
        updateNoteProperties(id: $id, expectedUpdatedAt: $version, patch: { set: [
            { key: "state", valueType: select, value: "todo" },
            { key: "priority", valueType: number, value: "2" },
            { key: "done", valueType: boolean, value: "true" }
        ] }) { id }
        createView(groupId: $groupId, input: {
            title: "Project tasks", displayType: table,
            displayOptions: { tableColumns: [title, properties], tablePropertyKeys: ["state", "priority", "done", "due", "summary", "source"] }
        }) { id }
    }`, { id: setup.note.id, version: setup.note.updatedAt, groupId: setup.group.id });
    return { noteId: String(setup.note.id), viewId: String(result.createView.id) };
};

const readProperties = async (page: Page, id: string) => {
    const result = await graph(page, 'query($id: ID!) { note(id: $id) { updatedAt properties { key value } } }', { id });
    return result.note;
};

test('table edits persist typed values and clearing removes only one property', async ({ page }, testInfo) => {
    // Arrange: a table with both existing and unset properties of each supported type.
    const errors = collectRuntimeErrors(page);
    const { noteId } = await setupTable(page);
    await page.goto('/views');
    const cell = (name: string) => page.getByRole('button', { name: `Edit ${name} for Review release` });

    // Act: edit the note in place without navigating to its editor.
    await cell('State').click();
    await page.getByRole('option', { name: 'Doing', exact: true }).click();
    await expect(cell('State')).toContainText('Doing');
    await cell('Priority').click();
    await page.getByRole('spinbutton', { name: 'Priority value' }).fill('0');
    await page.screenshot({ path: testInfo.outputPath('editing-number.png'), fullPage: true });
    await page.getByRole('spinbutton', { name: 'Priority value' }).press('Enter');
    await expect(cell('Priority')).toContainText('0');
    await cell('Done').click();
    await page.getByRole('checkbox', { name: 'Done value' }).press('Space');
    await expect(page.getByRole('checkbox', { name: 'Done value' })).not.toBeChecked();
    await page.getByRole('button', { name: 'Save Done', exact: true }).click();
    await expect(cell('Done')).toContainText('False');
    for (const [name, value] of [['Due', '2026-11-01'], ['Summary', 'Ready for QA'], ['Source', 'https://example.com/release']]) {
        await cell(name).click();
        await page.getByLabel(`${name} value`, { exact: true }).fill(value);
        await page.getByRole('button', { name: `Save ${name}`, exact: true }).click();
        await expect(cell(name)).toContainText(value);
    }
    await cell('Summary').click();
    await page.getByRole('button', { name: 'Clear Summary', exact: true }).click();
    await expect(cell('Summary')).toContainText('—');
    await page.reload();

    // Assert: the server kept typed falsy values, and clearing left the other properties intact.
    await expect(cell('State')).toContainText('Doing');
    await expect(cell('Priority')).toContainText('0');
    await expect(cell('Done')).toContainText('False');
    const note = await readProperties(page, noteId);
    expect(Object.fromEntries(note.properties.map((property: { key: string; value: string }) => [property.key, property.value]))).toEqual({
        state: 'doing', priority: '0', done: 'false', due: '2026-11-01', source: 'https://example.com/release',
    });
    await expect(page).toHaveURL((url) => url.pathname === '/views');
    await page.screenshot({ path: testInfo.outputPath('editable-table.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await cell('Priority').click();
    await expect(page.getByRole('spinbutton', { name: 'Priority value' })).toHaveValue('0');
    await page.screenshot({ path: testInfo.outputPath('editing-number-mobile.png'), fullPage: true });
    await page.getByRole('spinbutton', { name: 'Priority value' }).press('Escape');
    expect(errors).toEqual([]);
});

test('editing a linked table updates its filter membership without changing the parent note', async ({ page }) => {
    // Arrange: a linked table showing notes that are still todo.
    const errors = collectRuntimeErrors(page);
    const { noteId, viewId } = await setupTable(page);
    await graph(page, `mutation($id: ID!) { updateView(id: $id, input: {
        title: "Project tasks", displayType: table,
        displayOptions: { tableColumns: [title, properties], tablePropertyKeys: ["state", "priority"] },
        propertyFilters: [{ key: "state", valueType: select, operator: equals, value: "todo" }]
    }) { id } }`, { id: viewId });
    const content = JSON.stringify([
        { type: 'paragraph', content: [{ type: 'text', text: 'Project context.', styles: {} }], children: [] },
        { type: 'linkedView', props: { viewId, viewTitle: 'Project tasks' }, children: [] },
    ]);
    const parent = await graph(page, 'mutation($content: String!) { createNote(note: { title: "Project overview", content: $content }) { id updatedAt content } }', { content });
    await page.goto(`/${parent.createNote.id}`);
    const linked = page.locator(`[data-linked-view-id="${viewId}"]`);

    // Act: cancel a keyboard edit, then move the linked note outside the saved filter.
    await linked.getByRole('button', { name: 'Edit Priority for Review release' }).click();
    await linked.getByRole('spinbutton', { name: 'Priority value' }).fill('9');
    await linked.getByRole('spinbutton', { name: 'Priority value' }).press('Escape');
    await expect(linked.getByRole('button', { name: 'Edit Priority for Review release' })).toContainText('2');
    await linked.getByRole('button', { name: 'Edit State for Review release' }).click();
    await page.getByRole('option', { name: 'Doing', exact: true }).click();

    // Assert: the linked result refreshes while the parent content remains untouched.
    await expect(linked.getByRole('link', { name: 'Review release', exact: true })).toHaveCount(0);
    const child = await readProperties(page, noteId);
    expect(child.properties).toContainEqual({ key: 'state', value: 'doing' });
    expect(child.properties).toContainEqual({ key: 'priority', value: '2' });
    const savedParent = await graph(page, 'query($id: ID!) { note(id: $id) { updatedAt content } }', { id: parent.createNote.id });
    expect(savedParent.note).toEqual({ updatedAt: parent.createNote.updatedAt, content: parent.createNote.content });
    await expect(page).toHaveURL((url) => url.pathname === `/${parent.createNote.id}`);
    expect(errors).toEqual([]);
});

test('a stale table draft cannot overwrite a newer note property', async ({ page }) => {
    // Arrange: an open draft and a later update from another client.
    const errors = collectRuntimeErrors(page);
    const { noteId } = await setupTable(page);
    await page.goto('/views');
    await page.getByRole('button', { name: 'Edit Priority for Review release' }).click();
    await page.getByRole('spinbutton', { name: 'Priority value' }).fill('3');
    const before = await readProperties(page, noteId);
    await graph(page, `mutation($id: ID!, $version: String!) {
        updateNoteProperties(id: $id, expectedUpdatedAt: $version, patch: { set: [{ key: "priority", valueType: number, value: "4" }] }) { id }
    }`, { id: noteId, version: before.updatedAt });

    // Act: submit the stale draft, explicitly reload, then save against the new version.
    await page.getByRole('button', { name: 'Save Priority', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Priority value' })).toHaveValue('3');
    await expect(page.getByRole('button', { name: 'Save Priority', exact: true })).toBeDisabled();
    expect((await readProperties(page, noteId)).properties).toContainEqual({ key: 'priority', value: '4' });
    await page.getByRole('button', { name: 'Reload latest value', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: 'Priority value' })).toHaveValue('4');
    await page.getByRole('spinbutton', { name: 'Priority value' }).fill('5');
    await page.getByRole('button', { name: 'Save Priority', exact: true }).click();

    // Assert: only an explicit edit after reloading can replace the newer value.
    await expect(page.getByRole('button', { name: 'Edit Priority for Review release' })).toContainText('5');
    expect((await readProperties(page, noteId)).properties).toContainEqual({ key: 'priority', value: '5' });
    expect(errors).toEqual([]);
});
