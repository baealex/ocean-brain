import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
    createHtmlAssetsZipExport,
    createHtmlExport,
    createMarkdownExport,
    getNoteExportFilename,
} from './note-export';

describe('note-export', () => {
    it('creates a safe markdown filename from a note title', () => {
        expect(getNoteExportFilename('VSCode에서 탈출하기?', 'md')).toBe('vscode에서-탈출하기.md');
        expect(getNoteExportFilename('HTML Export', 'zip')).toBe('html-export.zip');
    });

    it('adds frontmatter when markdown metadata is requested', () => {
        const markdown = createMarkdownExport(
            'Body',
            {
                id: '123',
                title: 'Hello: World',
                createdAt: '1778198400000',
                updatedAt: '1778198400000',
            },
            true,
        );

        expect(markdown).toContain('---\ntitle: "Hello: World"');
        expect(markdown).toContain('note_id: 123');
        expect(markdown).toContain('source: ocean-brain\n---\n\nBody');
    });

    it('wraps html in a complete document when standalone mode is requested', () => {
        const html = createHtmlExport('<p>Body</p>', { id: '123', title: 'Hello <World>' }, { mode: 'standalone' });

        expect(html).toContain('<!doctype html>');
        expect(html).toContain('<title>Hello &lt;World&gt;</title>');
        expect(html).toContain('<p>Body</p>');
    });

    it('exports local image assets into a zip and rewrites html image paths', async () => {
        const zipBlob = await createHtmlAssetsZipExport(
            '<figure><img src="/assets/images/2026/4/15/photo.png" alt="Local"><img src="https://example.com/external.png" alt="External"></figure>',
            { id: '123', title: 'Hello' },
            {
                fetchImpl: async (input) => {
                    expect(input).toBe('/assets/images/2026/4/15/photo.png');

                    return new Response('image-bytes', {
                        status: 200,
                        headers: { 'Content-Type': 'image/png' },
                    });
                },
                mode: 'standalone',
            },
        );
        const zip = await JSZip.loadAsync(zipBlob);
        const html = await zip.file('note.html')?.async('string');
        const imageBytes = await zip.file('assets/photo.png')?.async('string');

        expect(html).toContain('src="./assets/photo.png"');
        expect(html).toContain('src="https://example.com/external.png"');
        expect(imageBytes).toBe('image-bytes');
    });

    it('deduplicates repeated local images in html zip exports', async () => {
        let fetchCount = 0;
        const zipBlob = await createHtmlAssetsZipExport(
            '<img src="/assets/images/a/same.png"><img src="/assets/images/a/same.png">',
            { id: '123', title: 'Hello' },
            {
                fetchImpl: async () => {
                    fetchCount += 1;

                    return new Response('same-image', {
                        headers: { 'Content-Type': 'image/png' },
                    });
                },
            },
        );
        const zip = await JSZip.loadAsync(zipBlob);
        const html = await zip.file('note.html')?.async('string');

        expect(fetchCount).toBe(1);
        expect(html?.match(/\.\/assets\/same\.png/g)).toHaveLength(2);
    });

    it('rewrites local image assets without reparsing the exported html document', async () => {
        const zipBlob = await createHtmlAssetsZipExport(
            '<IMG alt="Before > after" src=/assets/images/a/unquoted.png><p data-copy="<img src=\'/assets/images/not-real.png\'>">Text</p>',
            { id: '123', title: 'Hello' },
            {
                fetchImpl: async (input) => {
                    expect(input).toBe('/assets/images/a/unquoted.png');

                    return new Response('unquoted-image', {
                        headers: { 'Content-Type': 'image/png' },
                    });
                },
            },
        );
        const zip = await JSZip.loadAsync(zipBlob);
        const html = await zip.file('note.html')?.async('string');

        expect(html).toContain('src=./assets/unquoted.png');
        expect(html).toContain('data-copy="<img src=\'/assets/images/not-real.png\'>"');
        expect(await zip.file('assets/unquoted.png')?.async('string')).toBe('unquoted-image');
    });

    it('rejects html fallback responses for local image assets', async () => {
        await expect(
            createHtmlAssetsZipExport(
                '<img src="/assets/images/missing.png">',
                { id: '123', title: 'Hello' },
                {
                    fetchImpl: async () =>
                        new Response('<!doctype html><html></html>', {
                            status: 200,
                            headers: { 'Content-Type': 'text/html' },
                        }),
                },
            ),
        ).rejects.toThrow('Image asset did not return image content: /assets/images/missing.png');
    });
});
