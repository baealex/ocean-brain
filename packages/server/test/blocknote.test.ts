import test from 'node:test';
import assert from 'node:assert/strict';

import { blocksToMarkdown, markdownToBlocksJson } from '../src/modules/blocknote.js';

test('blocksToMarkdown preserves supported content when tableOfContents blocks are present', async () => {
    const content = JSON.stringify([
        {
            id: 'paragraph-1',
            type: 'paragraph',
            props: {
                backgroundColor: 'default',
                textColor: 'default',
                textAlignment: 'left'
            },
            content: [
                {
                    type: 'text',
                    text: 'hello world',
                    styles: {}
                }
            ],
            children: []
        },
        {
            id: 'toc-1',
            type: 'tableOfContents',
            props: {},
            children: []
        },
        {
            id: 'heading-1',
            type: 'heading',
            props: {
                backgroundColor: 'default',
                textColor: 'default',
                textAlignment: 'left',
                level: 3,
                isToggleable: false
            },
            content: [
                {
                    type: 'text',
                    text: 'weekly review',
                    styles: {}
                }
            ],
            children: []
        }
    ]);

    const markdown = await blocksToMarkdown(content);

    assert.match(markdown, /hello world/);
    assert.match(markdown, /weekly review/i);
});

test('markdownToBlocksJson restores custom tag and reference inline content from markdown', async () => {
    const contentJson = await markdownToBlocksJson(
        '#project [[Reference Note]]',
        {
            ensureTag: async () => ({
                id: '12',
                name: '@project'
            }),
            findNotesByTitle: async (title) => {
                if (title === 'Reference Note') {
                    return [{
                        id: '44',
                        title
                    }];
                }

                return [];
            }
        }
    );

    const blocks = JSON.parse(contentJson);

    assert.deepEqual(blocks[0].content, [
        {
            type: 'tag',
            props: {
                id: '12',
                tag: '@project'
            }
        },
        {
            type: 'text',
            text: ' ',
            styles: {}
        },
        {
            type: 'reference',
            props: {
                id: '44',
                title: 'Reference Note'
            }
        }
    ]);
});

test('markdownToBlocksJson leaves ambiguous references as plain text', async () => {
    const contentJson = await markdownToBlocksJson(
        'See [[Shared Title]] later',
        {
            ensureTag: async () => {
                throw new Error('should not ensure tags');
            },
            findNotesByTitle: async () => ([
                { id: '8', title: 'Shared Title' },
                { id: '9', title: 'Shared Title' }
            ])
        }
    );

    const blocks = JSON.parse(contentJson);

    assert.deepEqual(blocks[0].content, [
        {
            type: 'text',
            text: 'See [[Shared Title]] later',
            styles: {}
        }
    ]);
});
