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
    await expect(page.getByRole('combobox', { name: 'Workspace', exact: true })).toHaveCount(0);
    const initial = await graph(page, 'mutation { createNotePropertyKey(input: { name: "Status", valueType: text }) { key } }');

    await page.goto('/setting/workspaces');
    await page.getByLabel('New workspace').fill('Diet');
    await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Workspace', exact: true })).toContainText('Diet');
    const workspaceId = new URL(page.url()).searchParams.get('workspace');
    expect(workspaceId).toBeTruthy();
    await page.getByRole('button', { name: /Open a new note/ }).click();
    await page.getByRole('textbox', { name: 'Note title' }).fill('Diet journal');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Saved');
    const id = new URL(page.url()).pathname.slice(1);

    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Setting', exact: true }).click();
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
    await expect(page.getByRole('combobox', { name: 'Workspace', exact: true })).toContainText('Notes');
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
    await expect(page.getByText('2 results', { exact: true })).toBeVisible();
    await choose(page, 'Browse workspace', 'Diet');
    await expect(page.getByText('1 result', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Browse workspace' })).toContainText('Diet');
    await page.locator('main').getByRole('link', { name: 'Diet record', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Diet record');
    await expect(page.getByRole('combobox', { name: 'Workspace', exact: true })).toContainText('Diet');
    await page.goBack();
    await expect(page.getByRole('combobox', { name: 'Browse workspace' })).toContainText('Diet');
    const other = await context.newPage();
    await other.goto('/?workspace=1');
    await expect(other.locator('main').getByRole('link', { name: 'Idea record', exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Workspace', exact: true })).toContainText('Diet');
    await other.close();

    await graph(page, 'mutation($id: ID!) { updateWorkspace(id: $id, input: { archived: true }) { id } }', { id: workspaceId });
    await page.goto(`/${id}`);
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveAttribute('readonly');
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    await page.goto('/search?query=record');
    await expect(page.getByText('2 results', { exact: true })).toBeVisible();
    await graph(page, 'mutation($id: ID!) { updateWorkspace(id: $id, input: { archived: false }) { id } }', { id: workspaceId });
    await page.goto(`/${id}`);
    await expect(page.getByRole('textbox', { name: 'Note title' })).not.toHaveAttribute('readonly');
    expect(errors).toEqual([]);
});
