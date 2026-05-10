import { describe, expect, it } from 'vitest';
import { type MarkdownBlock, prepareBlocksForMarkdown, restoreTagPlaceholdersInMarkdown } from './blocknote-markdown';

describe('blocknote markdown helpers', () => {
    it('serializes custom references and tags into explicit markdown-friendly text', () => {
        const blocks: MarkdownBlock[] = [
            {
                type: 'paragraph',
                content: [
                    { type: 'tag', props: { tag: '@project' } },
                    { type: 'text', text: ' ', styles: {} },
                    { type: 'reference', props: { title: 'Reference Note' } },
                ],
                children: [],
            },
        ];

        const prepared = prepareBlocksForMarkdown(blocks);

        expect(prepared.blocks[0].content).toEqual([
            { type: 'text', text: 'OCEAN_BRAIN_TAG_0_TOKEN', styles: {} },
            { type: 'text', text: ' ', styles: {} },
            { type: 'text', text: '[[Reference Note]]', styles: {} },
        ]);
        expect(
            restoreTagPlaceholdersInMarkdown('OCEAN_BRAIN_TAG_0_TOKEN [[Reference Note]]', prepared.placeholderToTag),
        ).toBe('[@project] [[Reference Note]]');
    });

    it('strips unsupported table of contents blocks', () => {
        const prepared = prepareBlocksForMarkdown([
            { type: 'tableOfContents', content: [], children: [] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Body', styles: {} }], children: [] },
        ]);

        expect(prepared.blocks).toHaveLength(1);
        expect(prepared.blocks[0].type).toBe('paragraph');
    });

    it('serializes custom inline content inside table cells', () => {
        const prepared = prepareBlocksForMarkdown([
            {
                type: 'table',
                content: {
                    type: 'tableContent',
                    rows: [
                        {
                            cells: [
                                {
                                    content: [
                                        { type: 'tag', props: { tag: '#topic' } },
                                        { type: 'reference', props: { title: 'Table Note' } },
                                    ],
                                },
                            ],
                        },
                    ],
                },
                children: [],
            },
        ]);

        expect(prepared.blocks[0].content).toMatchObject({
            rows: [
                {
                    cells: [
                        {
                            content: [
                                { type: 'text', text: 'OCEAN_BRAIN_TAG_0_TOKEN', styles: {} },
                                { type: 'text', text: '[[Table Note]]', styles: {} },
                            ],
                        },
                    ],
                },
            ],
        });
    });
});
