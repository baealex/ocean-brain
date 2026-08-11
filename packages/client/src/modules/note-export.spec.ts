import JSZip from 'jszip';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    createHtmlAssetsZipExport,
    createHtmlDocumentExport,
    createMarkdownAssetsZipExport,
    createMarkdownDocumentExport,
    createMarkdownExport,
    downloadBlobFile,
    getNoteExportFilename,
} from './note-export';

describe('note-export', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('creates a safe markdown filename from a note title', () => {
        expect(getNoteExportFilename('VSCode에서 탈출하기?', 'md')).toBe('vscode에서-탈출하기.md');
        expect(getNoteExportFilename('HTML Export', 'zip')).toBe('html-export.zip');
        expect(getNoteExportFilename('CON', 'md')).toBe('note-con.md');
        expect(getNoteExportFilename('...', 'html')).toBe('untitled-note.html');
        expect(getNoteExportFilename('Report\u0000Draft. ', 'html')).toBe('report-draft.html');

        const longFilename = getNoteExportFilename('\uac00'.repeat(100), 'zip');

        expect(new TextEncoder().encode(longFilename).byteLength).toBeLessThanOrEqual(124);
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
        expect(markdown).toContain('note_id: "123"');
        expect(markdown).toContain('source: ocean-brain\n---\n\nBody');
    });

    it('keeps frontmatter values as valid YAML strings', () => {
        const markdown = createMarkdownExport(
            'Body',
            {
                id: 'true',
                title: 'Line one\n---\nadmin: true',
                createdAt: '8640000000000001',
                updatedAt: 'null',
            },
            true,
        );

        expect(markdown).toContain('title: "Line one\\n---\\nadmin: true"');
        expect(markdown).toContain('note_id: "true"');
        expect(markdown).toContain('created_at: "8640000000000001"');
        expect(markdown).toContain('updated_at: "null"');
        expect(markdown).not.toContain('title: Line one\n---\nadmin: true');
    });

    it('keeps exported html metadata inside a single comment', () => {
        const html = createHtmlDocumentExport(
            '<p>Body</p>',
            {
                id: '123-->\n<img src=x onerror=alert(1)><!-- --!>',
                title: 'Line 1\r\nLine 2 -- tail',
                createdAt: '8640000000000001',
            },
            { includeMetadata: true },
        );

        expect(html.split('-->')).toHaveLength(2);
        expect(html).not.toContain('--!>');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(html).not.toContain('<img src=x onerror=alert(1)>');
        expect(html).not.toContain('Line 1\r\nLine 2');
        expect(html).toContain('created_at: 8640000000000001');
        expect(html.endsWith('-->\n<p>Body</p>')).toBe(true);

        const container = document.createElement('div');

        container.innerHTML = html;
        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('p')?.textContent).toBe('Body');
    });

    it('omits local image assets from document-only markdown exports', () => {
        const markdown = createMarkdownDocumentExport(
            [
                'Before',
                '![Local](/assets/images/2026/4/15/photo.png)',
                '![(image) sample building photo.png](/assets/images/2024/8/13/1723517460089.png)',
                '![[[[]]] ((()))](/assets/images/nested/alt.png)',
                '![Title](/assets/images/with-title.png "Local title")',
                '![Paren URL](/assets/images/path/image(foo).png)',
                '![Angle URL](</assets/images/path/image(bar).png> "Angle title")',
                '![External](https://example.com/external.png)',
                '![External Paren](https://example.com/image(foo).png "External title")',
            ].join('\n'),
            { id: '123', title: 'Hello' },
        );

        expect(markdown).toBe(
            [
                'Before',
                '',
                '',
                '',
                '',
                '',
                '',
                '![External](https://example.com/external.png)',
                '![External Paren](https://example.com/image(foo).png "External title")',
            ].join('\n'),
        );
        expect(markdown).not.toContain('/assets/images/');
        expect(markdown).not.toContain('![(image) sample building photo.png]');
        expect(markdown).toContain('![External](https://example.com/external.png)');
        expect(markdown).toContain('![External Paren](https://example.com/image(foo).png "External title")');
    });

    it('exports local image assets into a markdown zip and rewrites markdown image paths', async () => {
        const zipBlob = await createMarkdownAssetsZipExport(
            '![Local](/assets/images/2026/4/15/photo.png)\n![External](https://example.com/external.png)',
            { id: '123', title: 'Hello' },
            {
                fetchImpl: async (input) => {
                    expect(input).toBe('/assets/images/2026/4/15/photo.png');

                    return new Response('image-bytes', {
                        status: 200,
                        headers: { 'Content-Type': 'image/png' },
                    });
                },
            },
        );
        const zip = await JSZip.loadAsync(zipBlob);
        const markdown = await zip.file('note.md')?.async('string');
        const imageBytes = await zip.file('assets/photo.png')?.async('string');

        expect(markdown).toContain('![Local](./assets/photo.png)');
        expect(markdown).toContain('![External](https://example.com/external.png)');
        expect(imageBytes).toBe('image-bytes');
    });

    it('resolves escaped markdown punctuation before fetching local image assets', async () => {
        const sourceMarkdown = '![Local](/assets/images/path/image\\(foo\\).png)';
        const zipBlob = await createMarkdownAssetsZipExport(
            sourceMarkdown,
            { id: '123', title: 'Hello' },
            {
                fetchImpl: async (input) => {
                    expect(input).toBe('/assets/images/path/image(foo).png');

                    return new Response('escaped-image', {
                        headers: { 'Content-Type': 'image/png' },
                    });
                },
            },
        );
        const zip = await JSZip.loadAsync(zipBlob);
        const markdown = await zip.file('note.md')?.async('string');

        expect(markdown).toBe('![Local](./assets/image-foo.png)');
        expect(await zip.file('assets/image-foo.png')?.async('string')).toBe('escaped-image');
        expect(createMarkdownDocumentExport(sourceMarkdown, { id: '123', title: 'Hello' })).toBe('');
    });

    it('omits local image assets from document-only html exports', () => {
        const html = createHtmlDocumentExport(
            '<figure><img src="/assets/images/2026/4/15/photo.png" alt="Local"><figcaption>Local photo</figcaption></figure><img src="https://example.com/external.png" alt="External">',
            { id: '123', title: 'Hello' },
        );

        expect(html).toBe(
            '<figure><figcaption>Local photo</figcaption></figure><img src="https://example.com/external.png" alt="External">',
        );
        expect(html).not.toContain('/assets/images/');
        expect(html).toContain('<figcaption>Local photo</figcaption>');
        expect(html).toContain('src="https://example.com/external.png"');
    });

    it('omits unquoted local image assets from document-only html exports', () => {
        const html = createHtmlDocumentExport(
            '<IMG alt="Before > after" src=/assets/images/a/unquoted.png><p data-copy="<img src=\'/assets/images/not-real.png\'>">Text</p>',
            { id: '123', title: 'Hello' },
        );

        expect(html).toBe('<p data-copy="<img src=\'/assets/images/not-real.png\'>">Text</p>');
        expect(html).not.toContain('src=/assets/images/a/unquoted.png');
        expect(html).toContain('data-copy="<img src=\'/assets/images/not-real.png\'>"');
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

    it('avoids case-insensitive asset name collisions in zip exports', async () => {
        const zipBlob = await createHtmlAssetsZipExport(
            '<img src="/assets/images/a/Photo.png"><img src="/assets/images/b/photo.PNG">',
            { id: '123', title: 'Hello' },
            {
                fetchImpl: async (input) =>
                    new Response(String(input), {
                        headers: { 'Content-Type': 'image/png' },
                    }),
            },
        );
        const zip = await JSZip.loadAsync(zipBlob);
        const html = await zip.file('note.html')?.async('string');

        expect(html).toContain('src="./assets/Photo.png"');
        expect(html).toContain('src="./assets/photo-2.png"');
        expect(zip.file('assets/Photo.png')).toBeTruthy();
        expect(zip.file('assets/photo-2.png')).toBeTruthy();
    });

    it('derives portable asset names from verified response types', async () => {
        const zipBlob = await createHtmlAssetsZipExport(
            '<img src="/assets/images/a/%ZZ.html"><img src="/assets/images/b/%2E%2E%2Fevil.svg">',
            { id: '123', title: 'Hello' },
            {
                fetchImpl: async (input) =>
                    new Response(String(input), {
                        headers: {
                            'Content-Type': String(input).includes('%ZZ') ? 'image/png' : 'image/jpeg',
                        },
                    }),
            },
        );
        const zip = await JSZip.loadAsync(zipBlob);
        const html = await zip.file('note.html')?.async('string');

        expect(html).toContain('src="./assets/ZZ.png"');
        expect(html).toContain('src="./assets/evil.jpg"');
        expect(zip.file('assets/ZZ.png')).toBeTruthy();
        expect(zip.file('assets/evil.jpg')).toBeTruthy();
        expect(zip.file('assets/ZZ.html')).toBeNull();
        expect(zip.file('assets/evil.svg')).toBeNull();
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

    it('rejects unsupported image types from local asset responses', async () => {
        await expect(
            createHtmlAssetsZipExport(
                '<img src="/assets/images/vector.svg">',
                { id: '123', title: 'Hello' },
                {
                    fetchImpl: async () =>
                        new Response('<svg></svg>', {
                            headers: { 'Content-Type': 'image/svg+xml' },
                        }),
                },
            ),
        ).rejects.toThrow('Image asset did not return image content: /assets/images/vector.svg');
    });

    it('cleans up the temporary download URL when the browser click fails', () => {
        const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:note-export');
        const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
            throw new Error('download blocked');
        });

        expect(() => downloadBlobFile(new Blob(['Body']), 'note.md')).toThrow('download blocked');
        expect(createObjectUrl).toHaveBeenCalledOnce();
        expect(revokeObjectUrl).toHaveBeenCalledWith('blob:note-export');
        expect(document.querySelector('a[download="note.md"]')).toBeNull();
    });
});
