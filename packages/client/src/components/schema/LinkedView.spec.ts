import { BlockNoteEditor, markdownToHTML } from '@blocknote/core';
import { act } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareBlocksForMarkdown } from '~/modules/blocknote-markdown';
import schema from './schema';

const editors: (typeof schema.BlockNoteEditor)[] = [];

afterEach(() => {
    editors.splice(0).forEach((editor) => editor.unmount());
});

describe('linked view document conversion', () => {
    it.each(['html', 'markdown'] as const)('%s round trips retain the connection and surrounding prose', (format) => {
        // Arrange: use the real schema instead of calling the custom parser directly.
        const editor = BlockNoteEditor.create({
            schema,
            initialContent: [
                { type: 'paragraph', content: 'Before the view.' },
                { type: 'linkedView', props: { viewId: '42', viewTitle: 'Meetings' } },
                { type: 'paragraph', content: 'After the view.' },
            ],
        });
        editors.push(editor);
        let html = '';
        let restored: typeof editor.document = [];

        // Act: traverse the actual serialization and registered parser order.
        act(() => {
            html =
                format === 'html'
                    ? editor.blocksToHTMLLossy(editor.document)
                    : markdownToHTML(editor.blocksToMarkdownLossy(prepareBlocksForMarkdown(editor.document).blocks));
            restored = editor.tryParseHTMLToBlocks(html);
        });

        // Assert: the reference identity and surrounding prose survive.
        const connection = restored.find((block) => block.type === 'linkedView');
        expect(connection?.props).toMatchObject({ viewId: '42', viewTitle: 'Meetings' });
        const text = restored
            .filter((block) => block.type === 'paragraph')
            .flatMap((block) => block.content.filter((inline) => inline.type === 'text').map((inline) => inline.text));
        expect(text).toEqual(['Before the view.', 'After the view.']);
    });

    it('importing an inline view link retains the entire sentence as prose', () => {
        // Arrange
        const editor = BlockNoteEditor.create({ schema });
        editors.push(editor);
        const html = '<p>See <a href="/views/notes?viewId=42">View: Meetings</a> for decisions.</p>';

        // Act
        const blocks = editor.tryParseHTMLToBlocks(html);
        const result = document.createElement('div');
        act(() => {
            result.innerHTML = editor.blocksToHTMLLossy(blocks);
        });

        // Assert
        expect(blocks.some((block) => block.type === 'linkedView')).toBe(false);
        expect(result.textContent).toBe('See View: Meetings for decisions.');
        expect(result.querySelector('a')?.getAttribute('href')).toBe('/views/notes?viewId=42');
    });
});
