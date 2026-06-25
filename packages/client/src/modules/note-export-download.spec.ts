import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { createNoteExportBlob, getNoteExportOutputExtension } from './note-export-download';

const metadata = {
    id: 'note-1',
    title: 'Export Target',
};

describe('note-export-download', () => {
    it('reports the visible output extension from format and asset settings', () => {
        expect(getNoteExportOutputExtension('html', false)).toBe('html');
        expect(getNoteExportOutputExtension('markdown', false)).toBe('md');
        expect(getNoteExportOutputExtension('html', true)).toBe('zip');
        expect(getNoteExportOutputExtension('markdown', true)).toBe('zip');
    });

    it('creates a document-only html download blob', async () => {
        const result = await createNoteExportBlob({
            format: 'html',
            includeAssets: false,
            includeMetadata: false,
            htmlMode: 'standalone',
            metadata,
            source: {
                getHtml: () => '<p>Hello</p><img src="/assets/images/a/photo.png">',
                getMarkdown: () => undefined,
            },
        });

        expect(result.type).toBe('success');
        if (result.type !== 'success') return;
        expect(result.filename).toBe('export-target.html');
        expect(result.blob.type).toBe('text/html;charset=utf-8');
        expect(await result.blob.text()).toContain('<p>Hello</p>');
        expect(await result.blob.text()).not.toContain('/assets/images/');
    });

    it('creates a document-only markdown download blob', async () => {
        const result = await createNoteExportBlob({
            format: 'markdown',
            includeAssets: false,
            includeMetadata: false,
            htmlMode: 'fragment',
            metadata,
            source: {
                getHtml: () => undefined,
                getMarkdown: () => 'Hello\n![Photo](/assets/images/a/photo.png)',
            },
        });

        expect(result.type).toBe('success');
        if (result.type !== 'success') return;
        expect(result.filename).toBe('export-target.md');
        expect(result.blob.type).toBe('text/markdown;charset=utf-8');
        expect(await result.blob.text()).toContain('Hello');
        expect(await result.blob.text()).not.toContain('/assets/images/');
    });

    it('creates a zip download blob when assets are included', async () => {
        const result = await createNoteExportBlob({
            format: 'markdown',
            fetchImpl: async () =>
                new Response('image-bytes', {
                    headers: { 'Content-Type': 'image/png' },
                }),
            includeAssets: true,
            includeMetadata: false,
            htmlMode: 'fragment',
            metadata,
            source: {
                getHtml: () => undefined,
                getMarkdown: () => '![Photo](/assets/images/a/photo.png)',
            },
        });

        expect(result.type).toBe('success');
        if (result.type !== 'success') return;
        expect(result.filename).toBe('export-target.zip');

        const zip = await JSZip.loadAsync(result.blob);
        const markdown = await zip.file('note.md')?.async('string');

        expect(markdown).toContain('./assets/photo.png');
        expect(zip.file('assets/photo.png')).toBeTruthy();
    });

    it('returns not-ready for a missing selected format payload', async () => {
        const result = await createNoteExportBlob({
            format: 'html',
            includeAssets: false,
            includeMetadata: false,
            htmlMode: 'fragment',
            metadata,
            source: {
                getHtml: () => undefined,
                getMarkdown: () => 'Markdown exists',
            },
        });

        expect(result).toEqual({
            type: 'not-ready',
            format: 'html',
        });
    });
});
