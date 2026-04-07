import test from 'node:test';
import assert from 'node:assert/strict';

import {
    blocksToMarkdown,
    extractTagIdsFromContentJson,
    markdownToBlocksJson
} from '../src/modules/blocknote.js';

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

test('blocksToMarkdown does not drop the whole note when table blocks are present', async () => {
    const content = JSON.stringify([
        {
            id: 'heading-1',
            type: 'heading',
            props: {
                backgroundColor: 'default',
                textColor: 'default',
                textAlignment: 'left',
                level: 2,
                isToggleable: false
            },
            content: [
                {
                    type: 'text',
                    text: 'Summary',
                    styles: {}
                }
            ],
            children: []
        },
        {
            id: 'table-1',
            type: 'table',
            props: {
                textColor: 'default'
            },
            content: {
                type: 'tableContent',
                columnWidths: [null, null],
                headerRows: 1,
                rows: [
                    {
                        cells: [
                            {
                                type: 'tableCell',
                                content: [
                                    {
                                        type: 'text',
                                        text: 'Name',
                                        styles: {}
                                    }
                                ],
                                props: {
                                    colspan: 1,
                                    rowspan: 1,
                                    backgroundColor: 'default',
                                    textColor: 'default',
                                    textAlignment: 'left'
                                }
                            },
                            {
                                type: 'tableCell',
                                content: [
                                    {
                                        type: 'text',
                                        text: 'Value',
                                        styles: {}
                                    }
                                ],
                                props: {
                                    colspan: 1,
                                    rowspan: 1,
                                    backgroundColor: 'default',
                                    textColor: 'default',
                                    textAlignment: 'left'
                                }
                            }
                        ]
                    }
                ]
            },
            children: []
        }
    ]);

    const markdown = await blocksToMarkdown(content);

    assert.match(markdown, /Summary/);
});

test('blocksToMarkdown serializes tags using explicit bracket syntax', async () => {
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
            ],
            children: []
        }
    ]);

    const markdown = await blocksToMarkdown(content);

    assert.match(markdown, /\[@project\]/);
    assert.match(markdown, /\[\[Reference Note\]\]/);
});

test('blocksToMarkdown serializes custom inline content inside table cells', async () => {
    const content = JSON.stringify([
        {
            id: 'table-1',
            type: 'table',
            props: {
                textColor: 'default'
            },
            content: {
                type: 'tableContent',
                columnWidths: [null, null],
                headerRows: 1,
                rows: [
                    {
                        cells: [
                            {
                                type: 'tableCell',
                                content: [
                                    {
                                        type: 'text',
                                        text: 'Name',
                                        styles: {}
                                    }
                                ],
                                props: {
                                    colspan: 1,
                                    rowspan: 1
                                }
                            },
                            {
                                type: 'tableCell',
                                content: [
                                    {
                                        type: 'text',
                                        text: 'Value',
                                        styles: {}
                                    }
                                ],
                                props: {
                                    colspan: 1,
                                    rowspan: 1
                                }
                            }
                        ]
                    },
                    {
                        cells: [
                            {
                                type: 'tableCell',
                                content: [
                                    {
                                        type: 'text',
                                        text: 'Project',
                                        styles: {}
                                    }
                                ],
                                props: {
                                    colspan: 1,
                                    rowspan: 1
                                }
                            },
                            {
                                type: 'tableCell',
                                content: [
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
                                ],
                                props: {
                                    colspan: 1,
                                    rowspan: 1
                                }
                            }
                        ]
                    }
                ]
            },
            children: []
        }
    ]);

    const markdown = await blocksToMarkdown(content);

    assert.match(markdown, /\[@project\]/);
    assert.match(markdown, /\[\[Reference Note\]\]/);
});

test('markdownToBlocksJson restores custom tag and reference inline content from explicit @ tags', async () => {
    const contentJson = await markdownToBlocksJson(
        '[@project] [[Reference Note]]',
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

test('markdownToBlocksJson restores custom tag and reference inline content from explicit # tags', async () => {
    const contentJson = await markdownToBlocksJson(
        '[#project] [[Reference Note]]',
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

test('markdownToBlocksJson leaves plain @ and # tokens as text to avoid accidental tag creation', async () => {
    const contentJson = await markdownToBlocksJson(
        'Use @layer and #111 as-is.',
        {
            ensureTag: async () => {
                throw new Error('should not ensure tags');
            },
            findNotesByTitle: async () => []
        }
    );

    const blocks = JSON.parse(contentJson);

    assert.deepEqual(blocks[0].content, [
        {
            type: 'text',
            text: 'Use @layer and #111 as-is.',
            styles: {}
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

test('markdownToBlocksJson restores custom inline content inside table cells', async () => {
    const contentJson = await markdownToBlocksJson(
        '| Name | Value |\n| --- | --- |\n| Project | [@project] [[Reference Note]] |',
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
    const tableBlock = blocks.find((block: { type: string }) => block.type === 'table');

    assert.ok(tableBlock);
    assert.deepEqual(tableBlock.content.rows[1].cells[1].content, [
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

test('extractTagIdsFromContentJson collects tags from table cells', () => {
    const tagIds = extractTagIdsFromContentJson(JSON.stringify([
        {
            id: 'table-1',
            type: 'table',
            content: {
                type: 'tableContent',
                rows: [
                    {
                        cells: [
                            {
                                type: 'tableCell',
                                content: [
                                    {
                                        type: 'tag',
                                        props: {
                                            id: '12',
                                            tag: '@project'
                                        }
                                    }
                                ]
                            },
                            {
                                type: 'tableCell',
                                content: [
                                    {
                                        type: 'tag',
                                        props: {
                                            id: '12',
                                            tag: '@project'
                                        }
                                    },
                                    {
                                        type: 'tag',
                                        props: {
                                            id: '34',
                                            tag: '@todo'
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            children: []
        }
    ]));

    assert.deepEqual(tagIds.sort(), ['12', '34']);
});
