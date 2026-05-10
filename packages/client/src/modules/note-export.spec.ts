import { describe, expect, it } from 'vitest';
import { createHtmlExport, createMarkdownExport, getNoteExportFilename } from './note-export';

describe('note-export', () => {
    it('creates a safe markdown filename from a note title', () => {
        expect(getNoteExportFilename('VSCode에서 탈출하기?', 'md')).toBe('vscode에서-탈출하기.md');
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
});
