import assert from 'node:assert/strict';
import test from 'node:test';

import { noteFieldResolvers, noteSnapshotFieldResolvers } from './note.field.resolver.js';

type NotePreviewResolver = (note: { content: string }) => unknown;
type SnapshotMarkdownResolver = (snapshot: { contentAsMarkdown?: string; payload?: string }) => Promise<unknown>;
const noteFields = noteFieldResolvers as Record<string, unknown>;
const noteSnapshotFields = noteSnapshotFieldResolvers as Record<string, unknown>;

test('contentPreview resolves visible text from note content', () => {
    const resolveContentPreview = noteFields.contentPreview as NotePreviewResolver;
    const content = JSON.stringify([
        {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Visible note body', styles: {} }],
        },
    ]);

    const preview = resolveContentPreview({ content });

    assert.equal(preview, 'Visible note body');
});

test('snapshot contentAsMarkdown returns materialized markdown without rendering its payload', async () => {
    const resolveContentAsMarkdown = noteSnapshotFields.contentAsMarkdown as SnapshotMarkdownResolver;

    const markdown = await resolveContentAsMarkdown({
        contentAsMarkdown: '# Materialized snapshot',
        payload: 'invalid payload that should not be read',
    });

    assert.equal(markdown, '# Materialized snapshot');
});

test('snapshot contentAsMarkdown renders legacy snapshot payloads', async () => {
    const resolveContentAsMarkdown = noteSnapshotFields.contentAsMarkdown as SnapshotMarkdownResolver;
    const content = JSON.stringify([
        {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Legacy snapshot body', styles: {} }],
        },
    ]);
    const payload = JSON.stringify({
        title: 'Legacy snapshot',
        content,
        pinned: false,
        order: 0,
        layout: 'wide',
    });

    const markdown = await resolveContentAsMarkdown({ payload });

    assert.match(String(markdown), /Legacy snapshot body/);
});

test('snapshot contentAsMarkdown returns an empty string when no content is available', async () => {
    const resolveContentAsMarkdown = noteSnapshotFields.contentAsMarkdown as SnapshotMarkdownResolver;

    const markdown = await resolveContentAsMarkdown({});

    assert.equal(markdown, '');
});
