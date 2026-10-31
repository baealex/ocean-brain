import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { collectRuntimeErrors } from './helpers/runtime-errors';

const signIn = async (page: Page) => {
    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
};

const graph = async (page: Page, query: string, variables: Record<string, unknown> = {}) => {
    const token = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value;
    if (!token) throw new Error('Missing session CSRF token');
    const response = await page.request.post('/graphql', { headers: { 'x-xsrf-token': decodeURIComponent(token) }, data: { query, variables } });
    expect(response.ok(), await response.text()).toBeTruthy();
    const body = await response.json();
    expect(body.errors).toBeUndefined();
    return body.data;
};

const choose = async (page: Page, label: string, option: string) => {
    await page.getByRole('combobox', { name: label, exact: true }).click();
    await page.getByRole('option', { name: option, exact: true }).click();
};

test('a second workspace reveals separation and a mapped move preserves the note and its links', async ({ page }, testInfo) => {
    const errors = collectRuntimeErrors(page);
    await signIn(page);
    await expect(page.getByRole('button', { name: 'Workspace', exact: true })).toHaveCount(0);
    const initial = await graph(page, 'mutation { createNotePropertyKey(input: { name: "Status", valueType: text }) { key } }');

    await page.goto('/setting/workspaces');
    await page.getByLabel('New workspace').fill('Diet');
    await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Workspace', exact: true })).toContainText('Diet');
    const workspaceId = new URL(page.url()).searchParams.get('workspace');
    expect(workspaceId).toBeTruthy();
    await page.getByRole('button', { name: /Open a new note/ }).click();
    await page.getByRole('textbox', { name: 'Note title' }).fill('Diet journal');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Saved');
    await expect(page).not.toHaveURL(/\/new$/);
    const id = new URL(page.url()).pathname.slice(1);

    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Setting', exact: true }).click();
    await page.getByRole('link', { name: /^Workspace settings/ }).click();
    await page.getByRole('link', { name: /^Properties/ }).click();
    await expect(page.getByText('No shared properties yet.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'New property', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Status');
    await page.getByRole('button', { name: 'Create property', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const fields = await graph(page, 'query($scope: WorkspaceScopeInput!) { notePropertyKeys(scope: $scope) { keys { key name } } }', { scope: { kind: 'workspace', workspaceId } });
    expect(fields.notePropertyKeys.keys).toHaveLength(1);
    const sourceKey = fields.notePropertyKeys.keys[0].key;
    expect(sourceKey).not.toBe(initial.createNotePropertyKey.key);
    const record = await graph(page, 'query($id: ID!) { note(id: $id) { updatedAt workspaceId } }', { id });
    expect(record.note.workspaceId).toBe(workspaceId);
    await graph(page, 'mutation($id: ID!, $version: String!, $key: String!) { updateNoteProperties(id: $id, expectedUpdatedAt: $version, patch: { set: [{ key: $key, valueType: text, value: "Open" }] }) { id } }', { id, version: record.note.updatedAt, key: sourceKey });
    const content = JSON.stringify([{ id: 'reference', type: 'paragraph', props: {}, content: [{ type: 'reference', props: { id, title: 'Diet journal' } }], children: [] }]);
    const linked = await graph(page, 'mutation($content: String!) { createNote(note: { title: "Linked idea", content: $content }) { id } }', { content });
    await page.goto(`/${id}`);
    await page.getByRole('button', { name: 'Note actions' }).click();
    await page.getByRole('menuitem', { name: 'Move to workspace', exact: true }).click();
    await choose(page, 'Destination workspace', 'Notes');
    await expect(page.getByRole('button', { name: 'Move note', exact: true })).toBeDisabled();
    await choose(page, 'Destination field for Status', 'Status');
    await page.getByRole('button', { name: 'Move note', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Workspace', exact: true })).toContainText('Notes');
    await expect(page).toHaveURL((url) => url.pathname === `/${id}`);
    const moved = await graph(page, 'query($id: ID!) { note(id: $id) { workspaceId properties { key value } } backReferences(id: $id) { id } noteSnapshots(id: $id) { id } }', { id });
    expect(moved.note).toEqual({ workspaceId: '1', properties: [{ key: initial.createNotePropertyKey.key, value: 'Open' }] });
    expect(moved.backReferences).toContainEqual({ id: linked.createNote.id });
    expect(moved.noteSnapshots.length).toBeGreaterThanOrEqual(2);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Diet journal');
    await page.screenshot({ path: testInfo.outputPath('moved-note.png'), fullPage: true });
    expect(errors).toEqual([]);
});

test('scope survives history and refresh while tabs and archived records retain their own context', async ({ page, context }) => {
    const errors = collectRuntimeErrors(page);
    await signIn(page);
    const setup = await graph(page, 'mutation { workspace: createWorkspace(name: "Diet") { id } idea: createNote(note: { title: "Idea record", content: "[]" }) { id } }');
    const workspaceId = setup.workspace.id;
    const result = await graph(page, 'mutation($workspaceId: ID!) { createNote(note: { workspaceId: $workspaceId, title: "Diet record", content: "[]" }) { id } }', { workspaceId });
    const id = result.createNote.id;
    await page.goto(`/?workspace=${workspaceId}`);
    await expect(page.locator('main').getByRole('link', { name: 'Diet record', exact: true })).toBeVisible();
    await expect(page.locator('main').getByRole('link', { name: 'Idea record', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Open detailed search' }).click();
    await page.getByRole('searchbox', { name: 'Search notes' }).fill('record');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByText('1 result', { exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Workspace filter' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Workspace', exact: true })).toContainText('Diet');
    await page.locator('main').getByRole('link', { name: 'Diet record', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Diet record');
    await expect(page.getByRole('button', { name: 'Workspace', exact: true })).toContainText('Diet');
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Workspace', exact: true })).toContainText('Diet');
    const other = await context.newPage();
    await other.goto('/?workspace=1');
    await expect(other.locator('main').getByRole('link', { name: 'Idea record', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Workspace', exact: true })).toContainText('Diet');
    await other.close();

    await graph(page, 'mutation($id: ID!) { updateWorkspace(id: $id, input: { archived: true }) { id } }', { id: workspaceId });
    await page.goto(`/${id}`);
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveAttribute('readonly');
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    await page.goto(`/search?query=record&workspace=${workspaceId}&scopeWorkspace=all`);
    await expect(page.getByText('1 result', { exact: true })).toBeVisible();
    await graph(page, 'mutation($id: ID!) { updateWorkspace(id: $id, input: { archived: false }) { id } }', { id: workspaceId });
    await page.goto(`/${id}`);
    await expect(page.getByRole('textbox', { name: 'Note title' })).not.toHaveAttribute('readonly');
    expect(errors).toEqual([]);
});

test('every navigation item stays inside the selected workspace', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await signIn(page);
    const setup = await graph(page, `mutation {
        workspace: createWorkspace(name: "Workspace 2") { id }
        shared: createTag(name: "@shared") { id }
        tagA: createTag(name: "@space-a") { id }
        tagB: createTag(name: "@space-b") { id }
    }`);
    const workspaceId = setup.workspace.id;
    for (const [space, suffix, tag] of [['1', 'A', setup.tagA], [workspaceId, 'B', setup.tagB]]) {
        const content = JSON.stringify([{
            type: 'paragraph',
            content: [setup.shared, tag].map((item) => ({ type: 'tag', props: { id: item.id, tag: item === setup.shared ? '@shared' : `@space-${suffix.toLowerCase()}` } })),
            children: [],
        }]);
        const record = await graph(page, `mutation($space: ID!, $content: String!, $title: String!) {
            note: createNote(note: { workspaceId: $space, title: $title, content: $content }) { id }
            group: createViewGroup(title: $title, workspaceId: $space) { id }
        }`, { space, content, title: `Shared phrase ${suffix}` });
        await graph(page, `mutation($group: ID!, $title: String!, $note: ID!, $date: String!) {
            createView(groupId: $group, input: { title: $title, displayType: table }) { id }
            createReminder(noteId: $note, reminderDate: $date) { id }
        }`, { group: record.group.id, title: `View ${suffix}`, note: record.note.id, date: new Date(Date.now() + 3_600_000).toISOString() });
    }
    await page.goto(`/?workspace=${workspaceId}&scopeWorkspace=all`);
    const workspace = page.getByRole('button', { name: 'Workspace', exact: true });
    const main = page.locator('main');
    const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
    await expect(workspace).toContainText('Workspace 2');
    await expect(main.getByRole('link', { name: 'Shared phrase B', exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Shared phrase A', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Manage workspaces', exact: true })).toHaveCount(0);

    await page.goto(`/search?workspace=${workspaceId}&query=Shared%20phrase&scopeWorkspace=all`);
    await expect(page.getByText('1 result', { exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Shared phrase B', exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Shared phrase A', exact: true })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Workspace filter' })).toHaveCount(0);

    await navigation.getByRole('link', { name: 'Tags', exact: true }).click();
    await expect(main.getByRole('link', { name: /@space-b/ })).toBeVisible();
    await expect(main.getByRole('link', { name: /@space-a/ })).toHaveCount(0);
    await main.getByRole('link', { name: /@shared\s+1/ }).click();
    await expect(main.getByRole('link', { name: 'Shared phrase B', exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Shared phrase A', exact: true })).toHaveCount(0);

    await navigation.getByRole('link', { name: 'Graph', exact: true }).click();
    await page.getByRole('button', { name: 'Review notes', exact: true }).click();
    await expect(main.getByText('Shared phrase B', { exact: true })).toBeVisible();
    await expect(main.getByText('Shared phrase A', { exact: true })).toHaveCount(0);
    await navigation.getByRole('link', { name: 'Views', exact: true }).click();
    await expect(main.getByText('View B', { exact: true })).toBeVisible();
    await expect(main.getByText('View A', { exact: true })).toHaveCount(0);
    await navigation.getByRole('link', { name: 'Calendar', exact: true }).click();
    await expect(main.getByText('Shared phrase B', { exact: true }).first()).toBeVisible();
    await expect(main.getByText('Shared phrase A', { exact: true })).toHaveCount(0);
    await navigation.getByRole('link', { name: 'Reminders', exact: true }).click();
    await expect(main.getByText('Shared phrase B', { exact: true }).first()).toBeVisible();
    await expect(main.getByText('Shared phrase A', { exact: true })).toHaveCount(0);
    await expect(workspace).toContainText('Workspace 2');
    await expect(page.getByRole('combobox', { name: 'Workspace filter' })).toHaveCount(0);

    await workspace.click();
    await expect(page.getByRole('menuitemradio', { name: 'All workspaces', exact: true })).toHaveCount(0);
    await page.getByRole('menuitemradio', { name: 'Notes', exact: true }).click();
    await expect(workspace).toContainText('Notes');
    await expect(main.getByRole('link', { name: 'Shared phrase A', exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Shared phrase B', exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('workspace tools have their own settings while app settings keep their familiar layout', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await signIn(page);
    const setup = await graph(page, 'mutation { createWorkspace(name: "Workspace 2") { id } }');
    const workspaceId = setup.createWorkspace.id;
    await page.goto(`/?workspace=${workspaceId}`);
    const workspace = page.getByRole('button', { name: 'Workspace', exact: true });
    const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
    await workspace.click();
    await page.getByRole('menuitem', { name: 'Workspace settings', exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/setting/workspace' && url.searchParams.get('workspace') === workspaceId);
    await expect(page.getByRole('heading', { name: 'Workspace settings', exact: true })).toBeVisible();
    await page.getByRole('link', { name: /^Properties/ }).click();
    await expect(page.getByText('No shared properties yet.', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Workspace settings · Workspace 2', exact: true }).click();
    await page.getByRole('link', { name: /^Trash/ }).click();
    await expect(page.getByText('Trash is empty', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Workspace settings · Workspace 2', exact: true }).click();
    await expect(workspace).toContainText('Workspace 2');

    await navigation.getByRole('link', { name: 'Setting', exact: true }).click();
    for (const heading of ['Appearance', 'Workspace', 'Advanced']) {
        await expect(page.locator('main').getByText(heading, { exact: true })).toBeVisible();
    }
    await expect(page.locator('main').getByText('Global settings', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Properties/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Trash/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Workspace settings/ })).toBeVisible();
    await page.getByRole('link', { name: /^Placeholders/ }).click();
    await expect(workspace).toContainText('Workspace 2');
    await page.goto('/setting');
    await expect(workspace).toContainText('Workspace 2');
    await page.getByRole('link', { name: /^Workspace settings/ }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/setting/workspace' && url.searchParams.get('workspace') === workspaceId);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('link', { name: /^Properties/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Trash/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    expect(errors).toEqual([]);
});
