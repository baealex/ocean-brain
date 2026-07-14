// @vitest-environment node

import { readFileSync } from 'node:fs';
import { cleanHTMLToMarkdown } from '@blocknote/core';
import { describe, expect, it, vi } from 'vitest';
import {
    formatBlockNoteMarkdownForClipboard,
    formatBlockNoteMarkdownForExport,
    handleBlockNotePaste,
    markdownToHTMLWithLiteralNumericRanges,
    normalizeBlockNoteCopy,
} from './blocknote-clipboard';

interface TildeContractCases {
    literalNumericRanges: Array<{ markdown: string; name: string }>;
    strikethrough: Array<{ markdown: string; name: string; struckText: string }>;
}

const tildeContractCases = JSON.parse(
    readFileSync(new URL('../../../../fixtures/markdown-tilde-cases.json', import.meta.url), 'utf8'),
) as TildeContractCases;

describe('markdownToHTMLWithLiteralNumericRanges', () => {
    it.each(tildeContractCases.literalNumericRanges)('$name', ({ markdown }) => {
        const html = markdownToHTMLWithLiteralNumericRanges(markdown);

        expect(html).toContain(markdown);
        expect(html).not.toContain('<del>');
    });

    it.each(tildeContractCases.strikethrough)('$name', ({ markdown, struckText }) => {
        const html = markdownToHTMLWithLiteralNumericRanges(markdown);

        expect(html).toContain(`<del>${struckText}</del>`);
    });

    it('preserves an email autolink containing a numeric tilde range shape', () => {
        const markdown = '<a1~b2@example.com>';

        const html = markdownToHTMLWithLiteralNumericRanges(markdown);

        expect(html).toBe('<p><a href="mailto:a1~b2@example.com">a1~b2@example.com</a></p>');
    });

    it('keeps numeric ranges literal inside angle-bracket text', () => {
        const markdown = '<1~3> before <4~5>';

        const html = markdownToHTMLWithLiteralNumericRanges(markdown);

        expect(html).toBe('<p>&#x3C;1~3> before &#x3C;4~5></p>');
    });

    it('preserves text matching the internal tilde placeholder', () => {
        const placeholder = '\uE000OBTILDE0\uE001';
        const markdown = `literal ${placeholder} and 1~3 and 4~5`;

        const html = markdownToHTMLWithLiteralNumericRanges(markdown);

        expect(html).toBe(`<p>literal ${placeholder} and 1~3 and 4~5</p>`);
    });

    it('restores literal tildes in code and link destinations after BlockNote parses Markdown', () => {
        const markdown = [
            '`1~3 and 4~5`',
            '',
            '[Profile](https://example.com/ranges/1~3/4~5)',
            '',
            '```text',
            '6~7 and 8~9',
            '```',
        ].join('\n');

        const html = markdownToHTMLWithLiteralNumericRanges(markdown);

        expect(html).toContain('<code>1~3 and 4~5</code>');
        expect(html).toContain('href="https://example.com/ranges/1~3/4~5"');
        expect(html).toContain('<pre><code data-language="text">6~7 and 8~9</code></pre>');
    });
});

describe('formatBlockNoteMarkdownForClipboard', () => {
    it('removes BlockNote serializer artifacts from readable Markdown', () => {
        const serialized = cleanHTMLToMarkdown(
            '<p>Prefix <strong>value!</strong>suffix. <a href="https://example.com/?first=1&amp;second=2">Reference</a></p>',
        );

        const markdown = formatBlockNoteMarkdownForClipboard(serialized);

        expect(markdown).toBe('Prefix **value!**suffix. [Reference](https://example.com/?first=1&second=2)\n');
    });

    it('normalizes prose around inline code', () => {
        const serialized = cleanHTMLToMarkdown(
            '<p><code>x</code> Prefix <strong>value!</strong>suffix. <a href="https://example.com/?first=1&amp;second=2">Reference</a></p>',
        );

        const markdown = formatBlockNoteMarkdownForClipboard(serialized);

        expect(markdown).toBe('`x` Prefix **value!**suffix. [Reference](https://example.com/?first=1&second=2)\n');
    });

    it('normalizes generated Markdown inside nested list items', () => {
        const serialized =
            '- Parent\n    - Prefix **value!**&#x73;uffix. [Reference](https://example.com/?first=1\\&second=2)\n';

        const markdown = formatBlockNoteMarkdownForClipboard(serialized);

        expect(markdown).toBe(
            '- Parent\n    - Prefix **value!**suffix. [Reference](https://example.com/?first=1&second=2)\n',
        );
    });

    it('leaves serializer-like text inside code unchanged', () => {
        const markdown = [
            '`**value!**&#x73;uffix [Reference](https://example.com/?first=1\\&second=2)`',
            '',
            '```markdown',
            '**value!**&#x73;uffix [Reference](https://example.com/?first=1\\&second=2)',
            '```',
        ].join('\n');

        const formatted = formatBlockNoteMarkdownForClipboard(markdown);

        expect(formatted).toBe(markdown);
    });

    it('normalizes serializer artifacts after an unmatched backtick', () => {
        const serialized = cleanHTMLToMarkdown(
            '<p>literal ` marker <strong>value!</strong>suffix <a href="https://example.com/?first=1&amp;second=2">Reference</a></p>',
        );

        const markdown = formatBlockNoteMarkdownForClipboard(serialized);

        expect(markdown).toBe('literal ` marker **value!**suffix [Reference](https://example.com/?first=1&second=2)\n');
    });

    it('matches inline-code delimiters by exact backtick-run length', () => {
        const serialized = cleanHTMLToMarkdown(
            '<p><code>a```b **value!**&amp;#x73;uffix</code> Prefix <strong>value!</strong>suffix</p>',
        );

        const markdown = formatBlockNoteMarkdownForClipboard(serialized);

        expect(markdown).toBe('`a```b **value!**&#x73;uffix` Prefix **value!**suffix\n');
    });

    it('preserves a literal character reference after an unmatched attention marker', () => {
        const markdown = 'Literal *&#x41; text';

        const formatted = formatBlockNoteMarkdownForClipboard(markdown);

        expect(formatted).toBe(markdown);
    });

    it('normalizes balanced and escaped parentheses in link destinations', () => {
        const markdown = [
            '[Balanced](https://example.com/a_(b)?first=1\\&second=2)',
            '[Escaped](https://example.com/a\\)b?first=1\\&second=2)',
        ].join(' ');

        const formatted = formatBlockNoteMarkdownForClipboard(markdown);

        expect(formatted).toBe(
            [
                '[Balanced](https://example.com/a_(b)?first=1&second=2)',
                '[Escaped](https://example.com/a\\)b?first=1&second=2)',
            ].join(' '),
        );
    });

    it('leaves a long unmatched link destination unchanged', () => {
        const markdown = `[Reference](https://example.com/${'\\('.repeat(10_000)}`;

        const formatted = formatBlockNoteMarkdownForClipboard(markdown);

        expect(formatted).toBe(markdown);
    });
});

describe('formatBlockNoteMarkdownForExport', () => {
    it('normalizes link destinations outside inline code', () => {
        const markdown =
            '`https://example.com/?first=1\\&second=2` [Reference](https://example.com/?first=1\\&second=2)\n';

        const formatted = formatBlockNoteMarkdownForExport(markdown);

        expect(formatted).toBe(
            '`https://example.com/?first=1\\&second=2` [Reference](https://example.com/?first=1&second=2)\n',
        );
    });

    it('normalizes link destinations after an unmatched backtick', () => {
        const markdown = 'literal ` marker [Reference](https://example.com/?first=1\\&second=2)\n';

        const formatted = formatBlockNoteMarkdownForExport(markdown);

        expect(formatted).toBe('literal ` marker [Reference](https://example.com/?first=1&second=2)\n');
    });
});

describe('normalizeBlockNoteCopy', () => {
    it('keeps canonical Markdown in its MIME type and writes a readable plain-text form', () => {
        const canonicalMarkdown = 'Prefix **value!**&#x73;uffix.';
        const setData = vi.fn();
        const clipboardData = {
            getData: vi.fn(() => canonicalMarkdown),
            setData,
        };

        normalizeBlockNoteCopy(clipboardData);

        expect(setData).toHaveBeenCalledWith('text/markdown', canonicalMarkdown);
        expect(setData).toHaveBeenCalledWith('text/plain', 'Prefix **value!**suffix.');
    });

    it('leaves the clipboard unchanged without serialized Markdown', () => {
        const setData = vi.fn();
        const clipboardData = {
            getData: vi.fn(() => ''),
            setData,
        };

        normalizeBlockNoteCopy(clipboardData);

        expect(setData).not.toHaveBeenCalled();
    });
});

describe('handleBlockNotePaste', () => {
    it('parses plain Markdown containing numeric tilde ranges through the protected path', () => {
        const pasteHTML = vi.fn();
        const defaultPasteHandler = vi.fn();
        const event = {
            clipboardData: {
                getData: vi.fn(() => '# Guide\n\nRanges are 1~3 and 4~5.'),
                types: ['text/plain'],
            },
        } as unknown as ClipboardEvent;

        const handled = handleBlockNotePaste({
            event,
            editor: {
                getTextCursorPosition: () => ({ block: { type: 'paragraph' } }),
                pasteHTML,
            },
            defaultPasteHandler,
        });

        expect(handled).toBe(true);
        expect(pasteHTML).toHaveBeenCalledWith('<h1>Guide</h1>\n<p>Ranges are 1~3 and 4~5.</p>');
        expect(defaultPasteHandler).not.toHaveBeenCalled();
    });

    it('keeps BlockNote default handling for ordinary Markdown', () => {
        const defaultPasteHandler = vi.fn(() => true);
        const event = {
            clipboardData: {
                getData: vi.fn(() => '# Guide\n\nKeep **important** text.'),
                types: ['text/plain'],
            },
        } as unknown as ClipboardEvent;

        const handled = handleBlockNotePaste({
            event,
            editor: {
                getTextCursorPosition: () => ({ block: { type: 'paragraph' } }),
                pasteHTML: vi.fn(),
            },
            defaultPasteHandler,
        });

        expect(handled).toBe(true);
        expect(defaultPasteHandler).toHaveBeenCalledOnce();
    });

    it('uses an explicit Markdown clipboard representation', () => {
        const pasteHTML = vi.fn();
        const defaultPasteHandler = vi.fn();
        const getData = vi.fn((type: string) =>
            type === 'text/markdown' ? 'Ranges are 1~3 and 4~5.' : 'plain fallback',
        );
        const event = {
            clipboardData: {
                getData,
                types: ['text/plain', 'text/markdown'],
            },
        } as unknown as ClipboardEvent;

        const handled = handleBlockNotePaste({
            event,
            editor: {
                getTextCursorPosition: () => ({ block: { type: 'paragraph' } }),
                pasteHTML,
            },
            defaultPasteHandler,
        });

        expect(handled).toBe(true);
        expect(getData).toHaveBeenCalledWith('text/markdown');
        expect(pasteHTML).toHaveBeenCalledWith('<p>Ranges are 1~3 and 4~5.</p>');
        expect(defaultPasteHandler).not.toHaveBeenCalled();
    });

    it('delegates paste handling inside code blocks', () => {
        const defaultPasteHandler = vi.fn(() => true);
        const event = {
            clipboardData: {
                getData: vi.fn(() => 'Ranges are 1~3 and 4~5.'),
                types: ['text/plain'],
            },
        } as unknown as ClipboardEvent;

        const handled = handleBlockNotePaste({
            event,
            editor: {
                getTextCursorPosition: () => ({ block: { type: 'codeBlock' } }),
                pasteHTML: vi.fn(),
            },
            defaultPasteHandler,
        });

        expect(handled).toBe(true);
        expect(defaultPasteHandler).toHaveBeenCalledOnce();
    });

    it.each(['Files', 'blocknote/html', 'vscode-editor-data'])('delegates the %s clipboard representation', (type) => {
        const defaultPasteHandler = vi.fn(() => true);
        const event = {
            clipboardData: {
                getData: vi.fn(() => 'Ranges are 1~3 and 4~5.'),
                types: [type, 'text/plain'],
            },
        } as unknown as ClipboardEvent;

        const handled = handleBlockNotePaste({
            event,
            editor: {
                getTextCursorPosition: () => ({ block: { type: 'paragraph' } }),
                pasteHTML: vi.fn(),
            },
            defaultPasteHandler,
        });

        expect(handled).toBe(true);
        expect(defaultPasteHandler).toHaveBeenCalledOnce();
    });

    it('keeps rich HTML priority for non-Markdown plain text containing numeric tilde ranges', () => {
        const defaultPasteHandler = vi.fn(() => true);
        const event = {
            clipboardData: {
                getData: vi.fn(() => 'Ranges are 1~3 and 4~5.'),
                types: ['text/html', 'text/plain'],
            },
        } as unknown as ClipboardEvent;

        handleBlockNotePaste({
            event,
            editor: {
                getTextCursorPosition: () => ({ block: { type: 'paragraph' } }),
                pasteHTML: vi.fn(),
            },
            defaultPasteHandler,
        });

        expect(defaultPasteHandler).toHaveBeenCalledOnce();
    });

    it('keeps Markdown priority over rich HTML for Markdown-looking plain text', () => {
        const defaultPasteHandler = vi.fn();
        const pasteHTML = vi.fn();
        const event = {
            clipboardData: {
                getData: vi.fn(() => '# Guide\n\nRanges are 1~3 and 4~5.'),
                types: ['text/html', 'text/plain'],
            },
        } as unknown as ClipboardEvent;

        const handled = handleBlockNotePaste({
            event,
            editor: {
                getTextCursorPosition: () => ({ block: { type: 'paragraph' } }),
                pasteHTML,
            },
            defaultPasteHandler,
        });

        expect(handled).toBe(true);
        expect(pasteHTML).toHaveBeenCalledWith('<h1>Guide</h1>\n<p>Ranges are 1~3 and 4~5.</p>');
        expect(defaultPasteHandler).not.toHaveBeenCalled();
    });

    it('keeps Markdown priority over rich HTML for table-shaped plain text', () => {
        const defaultPasteHandler = vi.fn();
        const pasteHTML = vi.fn();
        const markdown = ['| Range |', '| --- |', '| 1~3 |'].join('\n');
        const event = {
            clipboardData: {
                getData: vi.fn(() => markdown),
                types: ['text/html', 'text/plain'],
            },
        } as unknown as ClipboardEvent;

        const handled = handleBlockNotePaste({
            event,
            editor: {
                getTextCursorPosition: () => ({ block: { type: 'paragraph' } }),
                pasteHTML,
            },
            defaultPasteHandler,
        });

        expect(handled).toBe(true);
        expect(pasteHTML).toHaveBeenCalledOnce();
        expect(defaultPasteHandler).not.toHaveBeenCalled();
    });

    it('delegates long malformed table-shaped plain text without backtracking', () => {
        const defaultPasteHandler = vi.fn(() => true);
        const markdown = `|${'a|'.repeat(10_000)}1~3`;
        const event = {
            clipboardData: {
                getData: vi.fn(() => markdown),
                types: ['text/html', 'text/plain'],
            },
        } as unknown as ClipboardEvent;

        const handled = handleBlockNotePaste({
            event,
            editor: {
                getTextCursorPosition: () => ({ block: { type: 'paragraph' } }),
                pasteHTML: vi.fn(),
            },
            defaultPasteHandler,
        });

        expect(handled).toBe(true);
        expect(defaultPasteHandler).toHaveBeenCalledOnce();
    });
});
