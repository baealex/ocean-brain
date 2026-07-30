import { describe, expect, it } from 'vitest';

import { getSearchPreviewBlocks } from './search-preview';

describe('getSearchPreviewBlocks', () => {
    it('keeps structural meaning without returning editor-facing labels', () => {
        const content = JSON.stringify([
            {
                type: 'heading',
                props: { level: 2 },
                content: [{ type: 'text', text: 'A useful heading' }],
            },
            {
                type: 'bulletListItem',
                content: [{ type: 'text', text: 'A useful bullet' }],
            },
        ]);

        expect(getSearchPreviewBlocks(content, '')).toEqual([
            { kind: 'heading', text: 'A useful heading' },
            { kind: 'list', text: 'A useful bullet' },
        ]);
    });

    it('preserves quote and code structure for matching excerpts', () => {
        const content = JSON.stringify([
            {
                type: 'quote',
                content: [{ type: 'text', text: 'A quoted memory about the ocean' }],
            },
            {
                type: 'codeBlock',
                content: [{ type: 'text', text: 'ocean = remember()' }],
            },
        ]);

        expect(getSearchPreviewBlocks(content, 'ocean')).toEqual([
            { kind: 'quote', text: 'A quoted memory about the ocean' },
            { kind: 'code', text: 'ocean = remember()' },
        ]);
    });
});
