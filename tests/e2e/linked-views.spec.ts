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

const signIn = async (page: Page) => {
    await page.goto('/');
    await page.getByLabel('Password').fill('e2e-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/');
};

const createMeetingView = async (page: Page) => {
    const setup = await graph(
        page,
        `mutation {
        group: createViewGroup(title: "Project A") { id }
        tag: createTag(name: "@meeting") { id }
    }`,
    );
    const result = await graph(
        page,
        `mutation($content: String!, $groupId: ID!) {
        note: createNote(note: { title: "Weekly meeting", content: $content }) { id }
        view: createView(groupId: $groupId, input: { title: "Meeting notes", tagNames: ["@meeting"], displayType: table }) { id }
    }`,
        {
            content: JSON.stringify([
                {
                    type: 'paragraph',
                    content: [{ type: 'tag', props: { id: setup.tag.id, tag: '@meeting' } }],
                    children: [],
                },
            ]),
            groupId: setup.group.id,
        },
    );
    return { viewId: String(result.view.id), meetingId: String(result.note.id) };
};

const createNote = async (page: Page, title: string, blocks: unknown[]) => {
    const data = await graph(
        page,
        'mutation($title: String!, $content: String!) { createNote(note: { title: $title, content: $content }) { id } }',
        {
            title,
            content: JSON.stringify(blocks),
        },
    );
    return String(data.createNote.id);
};
const paragraph = (text: string) => ({
    type: 'paragraph',
    content: [{ type: 'text', text, styles: {} }],
    children: [],
});

test('a note follows the saved view when its original query changes', async ({ page }) => {
    // Arrange: two distinct sets of records and a saved view initially matching meetings.
    const errors = collectRuntimeErrors(page);
    await signIn(page);
    const { viewId } = await createMeetingView(page);
    const decisionTag = await graph(page, 'mutation { createTag(name: "@decision") { id } }');
    const decisionId = await createNote(page, 'Decision on scope', [
        {
            type: 'paragraph',
            content: [{ type: 'tag', props: { id: decisionTag.createTag.id, tag: '@decision' } }],
            children: [],
        },
    ]);
    const parentId = await createNote(page, 'Project overview', []);
    await page.goto(`/${parentId}`);
    const editor = page.locator('.bn-editor[contenteditable="true"]');
    const linked = page.locator(`[data-linked-view-id="${viewId}"]`);

    // Act: insert through the command, save, then change the ORIGINAL view and reopen the note.
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type('Project context');
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/view');
    await page.getByText('Linked View', { exact: true }).click();
    await page.getByRole('textbox', { name: 'Search views' }).fill('Project A');
    await page.getByRole('textbox', { name: 'Search views' }).press('Enter');
    await linked.getByRole('link', { name: 'Weekly meeting' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Saved');
    await graph(
        page,
        `mutation($id: ID!) { updateView(id: $id, input: {
        title: "Project decisions", tagNames: ["@decision"], displayType: table
    }) { id } }`,
        { id: viewId },
    );
    await page.reload();

    // Assert: it is a live reference, not copied rows or a frozen set of conditions.
    await expect(linked.getByRole('heading', { name: 'Project decisions' })).toBeVisible();
    await expect(linked.getByRole('link', { name: 'Decision on scope' })).toHaveAttribute('href', `/${decisionId}`);
    await expect(linked.getByRole('link', { name: 'Weekly meeting' })).toHaveCount(0);
    await expect(page.getByText('Project context', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
});

test('linked view selection stops highlighting when focus leaves the editor', async ({ page }) => {
    await signIn(page);
    const { viewId } = await createMeetingView(page);
    const parentId = await createNote(page, 'Project overview', [
        paragraph('Project context.'),
        { type: 'linkedView', props: { viewId, viewTitle: 'Meeting notes' }, children: [] },
        paragraph('After the view.'),
    ]);
    await page.goto(`/${parentId}`);
    const linked = page.locator(`[data-linked-view-id="${viewId}"]`);
    await linked.getByRole('heading', { name: 'Meeting notes' }).click();
    await expect(page.locator('.bn-editor')).toBeFocused();
    await expect(linked).toHaveCSS('outline-style', 'solid');

    await page.getByRole('textbox', { name: 'Note title' }).click();

    await expect(linked).toHaveCSS('outline-style', 'none');
    await expect(linked.getByRole('link', { name: 'Weekly meeting' })).toBeVisible();
    await expect(page.getByText('After the view.', { exact: true })).toBeVisible();
});

test('a note created from a linked view keeps its project context after editing', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await signIn(page);
    const { viewId } = await createMeetingView(page);
    await graph(page, `mutation($id: ID!) {
        createNotePropertyKey(input: { key: "kind", name: "Kind", valueType: text }) { key }
        updateView(id: $id, input: {
            tagNames: ["@project-a", "@meeting"],
            propertyFilters: [{ key: "kind", valueType: text, operator: equals, value: "meeting" }]
        }) { id }
    }`, { id: viewId });
    const parentId = await createNote(page, 'Project overview', [
        paragraph('Project context.'),
        { type: 'linkedView', props: { viewId, viewTitle: 'Meeting notes' }, children: [] },
    ]);
    await page.goto(`/${parentId}`);
    const linked = page.locator(`[data-linked-view-id="${viewId}"]`);

    await linked.getByRole('button', { name: 'New note', exact: true }).click();
    await expect(page).not.toHaveURL((url) => url.pathname === `/${parentId}`);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Note title' }).fill('Project planning meeting');
    const editor = page.locator('.bn-editor[contenteditable="true"]');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Decisions from the meeting.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Saved');
    await page.goto(`/${parentId}`);

    await expect(linked.getByRole('link', { name: 'Project planning meeting' })).toBeVisible();
    await expect(page.getByText('Project context.', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
});

test('creating in a board column assigns that column and survives reload', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await signIn(page);
    const setup = await graph(page, `mutation {
        group: createViewGroup(title: "Project A") { id }
        createNotePropertyKey(input: { key: "state", name: "State", valueType: select, options: [
            { label: "Todo", value: "todo" }, { label: "Doing", value: "doing" }
        ] }) { key }
    }`);
    await graph(page, `mutation($groupId: ID!) { createView(groupId: $groupId, input: {
        title: "Project tasks", displayType: board, tagNames: ["@project-a"],
        displayOptions: { boardGroupByPropertyKey: "state" }
    }) { id } }`, { groupId: setup.group.id });
    await page.goto('/views');

    await page.getByRole('button', { name: 'New note in Doing', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('');
    await page.getByRole('textbox', { name: 'Note title' }).fill('Implement capture');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Saved');
    await page.goto('/views');
    await page.reload();

    await expect(page.getByRole('region', { name: 'Doing column' }).getByRole('link', { name: 'Implement capture' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Todo column' }).getByRole('link', { name: 'Implement capture' })).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('a saved template creates independent notes with the current view context', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await signIn(page);
    const { viewId } = await createMeetingView(page);
    const setup = await graph(page, `mutation {
        oldTag: createTag(name: "@old-project") { id }
        project: createNotePropertyKey(input: { key: "project", name: "Project", valueType: text }) { key }
        owner: createNotePropertyKey(input: { key: "owner", name: "Owner", valueType: text }) { key }
    }`);
    const templateId = await createNote(page, 'Meeting outline', [
        { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Agenda', styles: {} }], children: [] },
        paragraph('Discuss the project.'),
        { type: 'paragraph', content: [{ type: 'tag', props: { id: setup.oldTag.id, tag: '@old-project' } }], children: [] },
    ]);
    const version = await graph(page, 'query($id: ID!) { note(id: $id) { updatedAt } }', { id: templateId });
    await graph(page, `mutation($id: ID!, $version: String!) {
        updateNoteProperties(id: $id, expectedUpdatedAt: $version, patch: { set: [
            { key: "project", valueType: text, value: "Other" }, { key: "owner", valueType: text, value: "Alex" }
        ] }) { id }
    }`, { id: templateId, version: version.note.updatedAt });
    await graph(page, `mutation($id: ID!) { updateView(id: $id, input: {
        title: "Project meetings", tagNames: ["@project-a", "@meeting"],
        propertyFilters: [{ key: "project", valueType: text, operator: equals, value: "A" }]
    }) { id } }`, { id: viewId });
    await page.goto('/views');

    await page.getByRole('button', { name: 'View actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Edit view', exact: true }).click();
    await page.getByRole('button', { name: 'Choose template', exact: true }).click();
    await page.getByLabel('Search template notes').fill('Meeting outline');
    await page.getByRole('button', { name: 'Meeting outline', exact: true }).click();
    await page.getByRole('button', { name: 'Save view', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.reload();
    await page.getByRole('button', { name: 'New note', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Meeting outline');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Note title' }).fill('Planning session');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Saved');

    await expect(page.getByRole('heading', { name: 'Agenda', exact: true })).toBeVisible();
    await expect(page.getByText('Discuss the project.', { exact: true })).toBeVisible();
    const createdId = new URL(page.url()).pathname.slice(1);
    const result = await graph(page, `query($createdId: ID!, $templateId: ID!) {
        created: note(id: $createdId) { tags { name } properties { key value } }
        template: note(id: $templateId) { tags { name } properties { key value } }
    }`, { createdId, templateId });
    expect(result.created.tags.map((tag: { name: string }) => tag.name).sort()).toEqual(['@meeting', '@project-a']);
    expect(result.created.properties).toEqual([{ key: 'owner', value: 'Alex' }, { key: 'project', value: 'A' }]);
    expect(result.template.tags).toEqual([{ name: '@old-project' }]);
    expect(result.template.properties).toContainEqual({ key: 'owner', value: 'Alex' });
    expect(createdId).not.toBe(templateId);
    expect(errors).toEqual([]);
});

test('exported Markdown reconnects the same view when pasted into another note', async ({ page }) => {
    // Arrange: the rendered source contains real result rows; the destination has its own prose.
    const errors = collectRuntimeErrors(page);
    await signIn(page);
    const { viewId, meetingId } = await createMeetingView(page);
    const sourceId = await createNote(page, 'Source project', [
        paragraph('Before the view.'),
        { type: 'linkedView', props: { viewId, viewTitle: 'Meeting notes' }, children: [] },
        paragraph('After the view.'),
    ]);
    const destinationId = await createNote(page, 'Destination project', [paragraph('Destination context.')]);
    await page.goto(`/${sourceId}`);
    await page.getByRole('link', { name: 'Weekly meeting' }).waitFor({ state: 'visible' });

    // Act: use the public export UI and paste the actual exported document into a different note.
    await page.getByRole('button', { name: 'Note actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Download document' }).click();
    await page.getByRole('radio', { name: '.md', exact: true }).check();
    await page.getByText('Include local image assets', { exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download .md', exact: true }).click();
    const stream = await (await downloadPromise).createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const markdown = Buffer.concat(chunks).toString('utf8');
    await page.goto(`/${destinationId}`);
    const editor = page.locator('.bn-editor[contenteditable="true"]');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.press('Enter');
    // Supply an external clipboard payload without relying on OS clipboard permissions.
    await editor.evaluate((element, text) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/markdown', text);
        element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
    }, markdown);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Saved');
    await page.reload();

    // Assert: preserve document context and reference identity, without copying query results into the body.
    expect(markdown).toContain(`/views/notes?viewId=${viewId}`);
    expect(markdown).not.toContain('Weekly meeting');
    await expect(page.getByText('Destination context.', { exact: true })).toBeVisible();
    await expect(page.getByText('Before the view.', { exact: true })).toBeVisible();
    await expect(page.getByText('After the view.', { exact: true })).toBeVisible();
    await expect(
        page.locator(`[data-linked-view-id="${viewId}"]`).getByRole('link', { name: 'Weekly meeting' }),
    ).toHaveAttribute('href', `/${meetingId}`);
    expect(errors).toEqual([]);
});


test('an unresolved creation adopts refreshed conditions without losing the draft', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await signIn(page);
    const { viewId } = await createMeetingView(page);
    await graph(page, `mutation($id: ID!) { updateView(id: $id, input: {
        tagNames: ["@meeting", "@decision"], mode: or
    }) { id } }`, { id: viewId });
    await page.goto('/views');
    await page.getByRole('button', { name: 'New note', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'New note in view' });
    await dialog.getByLabel('Title', { exact: true }).fill('Meeting draft');
    await dialog.getByText('@meeting', { exact: true }).click();

    await graph(page, `mutation($id: ID!) {
        createNotePropertyKey(input: { key: "owner", name: "Owner", valueType: text }) { key }
        updateView(id: $id, input: { tagNames: ["@meeting", "@decision"], mode: or,
            propertyFilters: [{ key: "owner", valueType: text, operator: equals, value: "Alex" }]
        }) { id }
    }`, { id: viewId });
    await page.evaluate(() => { window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online')); });
    await expect(dialog.getByLabel('Owner *')).toHaveValue('Alex');
    await dialog.getByRole('button', { name: 'Create note', exact: true }).click();

    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue('Meeting draft');
    const id = new URL(page.url()).pathname.slice(1);
    const result = await graph(page, 'query($id: ID!) { note(id: $id) { tags { name } properties { key value } } }', { id });
    expect(result.note.tags).toEqual([{ name: '@meeting' }]);
    expect(result.note.properties).toEqual([{ key: 'owner', value: 'Alex' }]);
    expect(errors).toEqual([]);
});
