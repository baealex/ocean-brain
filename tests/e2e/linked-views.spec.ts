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
    await page.getByRole('button', { name: /Meeting notes.*Project A/ }).click();
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
