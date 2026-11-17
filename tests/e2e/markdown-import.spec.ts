import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import JSZip from 'jszip';
import { createMarkdownAssetsZipExport } from '../../packages/client/src/modules/note-export';
import { expect, test } from './fixtures';
import { collectRuntimeErrors } from './helpers/runtime-errors';

const fixture = path.resolve('tests/fixtures/markdown-import/vault');
const graph = async (page: Page, query: string, variables: Record<string, unknown> = {}) => {
    const token = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value;
    const response = await page.request.post('/graphql', {
        headers: { 'x-xsrf-token': decodeURIComponent(token ?? '') },
        data: { query, variables },
    });
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
const imported = (page: Page) =>
    page.evaluate(
        () =>
            JSON.parse(sessionStorage.getItem('ocean-brain:markdown-import-result') ?? '{}') as {
                ids: Record<string, string>;
                indexId: string;
                saved: number;
            },
    );

test('folder import creates linked notes, an uploaded image, properties, dates and a contents note, then trashes the batch', async ({
    page,
}) => {
    const errors = collectRuntimeErrors(page);
    await signIn(page);
    await page.getByRole('link', { name: 'Import Markdown', exact: true }).click();
    await page.getByLabel('Upload folder').setInputFiles(fixture);
    await expect(page.getByRole('button', { name: 'Import 4 notes' })).toBeEnabled();
    await page.getByRole('button', { name: 'Import 4 notes' }).click();
    await expect(page.getByText('4 notes imported')).toBeVisible();
    const result = await imported(page);
    const startId = result.ids['Start.md'];
    const decisionId = result.ids['Projects/Decision.md'];
    const persisted = await graph(
        page,
        'query($id: ID!, $target: ID!) { note(id: $id) { content createdAt updatedAt properties { name value valueType } tags { name } } backReferences(id: $target) { id } }',
        { id: startId, target: decisionId },
    );
    expect(Number(persisted.note.createdAt)).toBe(Date.parse('2020-01-02T00:00:00Z'));
    expect(Number(persisted.note.updatedAt)).toBe(Date.parse('2021-03-04T12:00:00Z'));
    expect(persisted.note.properties).toEqual(
        expect.arrayContaining([
            { name: 'priority', value: '4', valueType: 'number' },
            { name: 'reviewed', value: 'true', valueType: 'boolean' },
        ]),
    );
    expect(persisted.backReferences).toContainEqual({ id: startId });
    expect(persisted.note.tags).toContainEqual({ name: '@synthetic' });
    const image = JSON.parse(persisted.note.content).find((block: { type: string }) => block.type === 'image');
    expect(image.props.url).toMatch(/^\/assets\/images\//);
    expect((await page.request.get(image.props.url)).ok()).toBe(true);
    await page.getByRole('link', { name: 'Open contents note' }).click();
    await expect(page.getByRole('textbox', { name: 'Note title' })).toHaveValue(/^Import — vault — \d{4}-\d{2}-\d{2}/);
    await expect(page.locator('.bn-editor')).toContainText('Projects');
    await page.goto('/setting/import');
    await page.getByRole('button', { name: 'Move all imported notes to trash' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'OK' }).click();
    await expect(page.getByText('Imported notes moved to trash')).toBeVisible();
    expect(
        (
            await graph(
                page,
                'query { allNotes(searchFilter: {query: ""}, pagination: {limit: 1, offset: 0}) { totalCount } }',
            )
        ).allNotes.totalCount,
    ).toBe(0);
    expect(errors).toEqual([]);
});

test('Notion UTF-8 zip imports CSV properties, an extensionless image and row links', async ({ page }) => {
    const id = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const row = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const zip = new JSZip();
    zip.file(`프로젝트 ${id}.md`, `# 프로젝트\n\n[표](프로젝트%20${id}_all.csv)\n\nfilters: \nStatus`);
    zip.file(`프로젝트 ${id}_all.csv`, '\uFEFFName,Status,Due date\n선택,Done,"October 26, 2026"\n');
    zip.file(
        `프로젝트/선택 ${row}.md`,
        '# 선택\n\nStatus: Done\nDue date: October 26, 2026\n\n<aside>Keep the chosen decision.</aside>\n\n![pixel](../attachments/pixel)',
    );
    zip.file('attachments/pixel', fs.readFileSync(path.join(fixture, 'pixel.png')));
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    await signIn(page);
    await page.goto('/setting/import');
    await page.getByLabel('Upload zip').setInputFiles({ name: 'notion.zip', mimeType: 'application/zip', buffer });
    await page.getByRole('button', { name: 'Import 2 notes' }).click();
    await expect(page.getByText('2 notes imported')).toBeVisible();
    const result = await imported(page);
    const rowId = result.ids[`프로젝트/선택 ${row}.md`];
    const persisted = await graph(
        page,
        'query($id: ID!) { note(id: $id) { title content properties { name value valueType } } backReferences(id: $id) { id } }',
        { id: rowId },
    );
    expect(persisted.note.title).toBe('선택');
    expect(persisted.note.content).toContain('Keep the chosen decision.');
    expect(persisted.note.properties).toContainEqual({
        name: 'Due date',
        value: '2026-10-26',
        valueType: 'date',
    });
    expect(persisted.backReferences.length).toBeGreaterThan(0);
});

test('an Ocean Brain Markdown assets zip can be imported again with dates and image preserved', async ({ page }) => {
    const exported = await createMarkdownAssetsZipExport(
        'A preserved choice.\n\n![pixel](/assets/images/pixel.png)',
        {
            id: '99',
            title: 'Exported decision',
            createdAt: '2020-01-02T00:00:00.000Z',
            updatedAt: '2021-03-04T12:00:00.000Z',
            workspaceId: '1',
            workspaceName: 'Original',
        },
        {
            includeMetadata: true,
            fetchImpl: async () =>
                new Response(fs.readFileSync(path.join(fixture, 'pixel.png')), {
                    headers: { 'content-type': 'image/png' },
                }),
        },
    );
    const buffer = Buffer.from(await exported.arrayBuffer());
    await signIn(page);
    await page.goto('/setting/import');
    await page.getByLabel('Upload zip').setInputFiles({
        name: 'ocean-brain.zip',
        mimeType: 'application/zip',
        buffer,
    });
    await page.getByRole('button', { name: 'Import 1 note' }).click();
    await expect(page.getByText('1 note imported')).toBeVisible();
    const result = await imported(page);
    const persisted = await graph(page, 'query($id: ID!) { note(id: $id) { title createdAt content } }', {
        id: result.ids['note.md'],
    });
    expect(persisted.note.title).toBe('Exported decision');
    expect(Number(persisted.note.createdAt)).toBe(Date.parse('2020-01-02T00:00:00Z'));
    expect(persisted.note.content).toContain('/assets/images/');
});
