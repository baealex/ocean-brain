import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
    blocksToMarkdown,
    countReferenceInlinesFromContentJson,
    extractLiteralAngleBracketTextTokens,
    extractTagIdsFromContentJson,
    hasNumericTildeRangeMarkerLoss,
    hasNumericTildeRangeMarkers,
    hasUnsupportedMarkdownBlocks,
    markdownToBlocksJson,
} from '../src/modules/blocknote.js';

interface TildeContractCases {
    literalNumericRanges: Array<{ markdown: string; name: string }>;
    strikethrough: Array<{ markdown: string; name: string; struckText: string }>;
}

const tildeContractCases = JSON.parse(
    readFileSync(new URL('../../../fixtures/markdown-tilde-cases.json', import.meta.url), 'utf8'),
) as TildeContractCases;

const noopMarkdownImportDeps = {
    ensureTag: async () => {
        throw new Error('should not ensure tags');
    },
    findNotesByTitle: async () => [],
};

test('blocksToMarkdown preserves supported content when tableOfContents blocks are present', async () => {
    const content = JSON.stringify([
        {
            id: 'paragraph-1',
            type: 'paragraph',
            props: {
                backgroundColor: 'default',
                textColor: 'default',
                textAlignment: 'left',
            },
            content: [
                {
                    type: 'text',
                    text: 'hello world',
                    styles: {},
                },
            ],
            children: [],
        },
        {
            id: 'toc-1',
            type: 'tableOfContents',
            props: {},
            children: [],
        },
        {
            id: 'heading-1',
            type: 'heading',
            props: {
                backgroundColor: 'default',
                textColor: 'default',
                textAlignment: 'left',
                level: 3,
                isToggleable: false,
            },
            content: [
                {
                    type: 'text',
                    text: 'weekly review',
                    styles: {},
                },
            ],
            children: [],
        },
    ]);

    const markdown = await blocksToMarkdown(content);

    assert.match(markdown, /hello world/);
    assert.match(markdown, /weekly review/i);
});

test('hasUnsupportedMarkdownBlocks detects BlockNote-only blocks before markdown writes', () => {
    const content = JSON.stringify([
        {
            id: 'paragraph-1',
            type: 'paragraph',
            content: [{ type: 'text', text: 'Supported text', styles: {} }],
            children: [],
        },
        {
            id: 'toc-1',
            type: 'tableOfContents',
            props: {},
            children: [],
        },
    ]);

    assert.equal(hasUnsupportedMarkdownBlocks(content), true);
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
                isToggleable: false,
            },
            content: [
                {
                    type: 'text',
                    text: 'Summary',
                    styles: {},
                },
            ],
            children: [],
        },
        {
            id: 'table-1',
            type: 'table',
            props: {
                textColor: 'default',
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
                                        styles: {},
                                    },
                                ],
                                props: {
                                    colspan: 1,
                                    rowspan: 1,
                                    backgroundColor: 'default',
                                    textColor: 'default',
                                    textAlignment: 'left',
                                },
                            },
                            {
                                type: 'tableCell',
                                content: [
                                    {
                                        type: 'text',
                                        text: 'Value',
                                        styles: {},
                                    },
                                ],
                                props: {
                                    colspan: 1,
                                    rowspan: 1,
                                    backgroundColor: 'default',
                                    textColor: 'default',
                                    textAlignment: 'left',
                                },
                            },
                        ],
                    },
                ],
            },
            children: [],
        },
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
                textAlignment: 'left',
            },
            content: [
                {
                    type: 'tag',
                    props: {
                        id: '12',
                        tag: '@project',
                    },
                },
                {
                    type: 'text',
                    text: ' ',
                    styles: {},
                },
                {
                    type: 'reference',
                    props: {
                        id: '44',
                        title: 'Reference Note',
                    },
                },
            ],
            children: [],
        },
    ]);

    const markdown = await blocksToMarkdown(content);

    assert.match(markdown, /\[@project\]/);
    assert.match(markdown, /\[\[Reference Note\]\]\(note:44\)/);
});

test('blocksToMarkdown serializes custom inline content inside table cells', async () => {
    const content = JSON.stringify([
        {
            id: 'table-1',
            type: 'table',
            props: {
                textColor: 'default',
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
                                        styles: {},
                                    },
                                ],
                                props: {
                                    colspan: 1,
                                    rowspan: 1,
                                },
                            },
                            {
                                type: 'tableCell',
                                content: [
                                    {
                                        type: 'text',
                                        text: 'Value',
                                        styles: {},
                                    },
                                ],
                                props: {
                                    colspan: 1,
                                    rowspan: 1,
                                },
                            },
                        ],
                    },
                    {
                        cells: [
                            {
                                type: 'tableCell',
                                content: [
                                    {
                                        type: 'text',
                                        text: 'Project',
                                        styles: {},
                                    },
                                ],
                                props: {
                                    colspan: 1,
                                    rowspan: 1,
                                },
                            },
                            {
                                type: 'tableCell',
                                content: [
                                    {
                                        type: 'tag',
                                        props: {
                                            id: '12',
                                            tag: '@project',
                                        },
                                    },
                                    {
                                        type: 'text',
                                        text: ' ',
                                        styles: {},
                                    },
                                    {
                                        type: 'reference',
                                        props: {
                                            id: '44',
                                            title: 'Reference Note',
                                        },
                                    },
                                ],
                                props: {
                                    colspan: 1,
                                    rowspan: 1,
                                },
                            },
                        ],
                    },
                ],
            },
            children: [],
        },
    ]);

    const markdown = await blocksToMarkdown(content);

    assert.match(markdown, /\[@project\]/);
    assert.match(markdown, /\[\[Reference Note\]\]\(note:44\)/);
});

test('markdownToBlocksJson restores note-id references with current note title', async () => {
    const contentJson = await markdownToBlocksJson('See [[Old Title]](note:44)', {
        ensureTag: async () => {
            throw new Error('should not ensure tags');
        },
        findNotesByTitle: async () => {
            throw new Error('should not look up title-based references');
        },
        findNoteById: async (id) =>
            id === '44'
                ? {
                      id: '44',
                      title: 'Current Title',
                  }
                : null,
    });

    const blocks = JSON.parse(contentJson);

    assert.deepEqual(blocks[0].content, [
        {
            type: 'text',
            text: 'See ',
            styles: {},
        },
        {
            type: 'reference',
            props: {
                id: '44',
                title: 'Current Title',
            },
        },
    ]);
});

test('markdownToBlocksJson restores note-id references whose title contains square brackets', async () => {
    const cases = [
        { markdown: 'See [[[P] Project brief]](note:123)', currentTitle: '[P] Project brief' },
        { markdown: 'See [[Project [P] brief]](note:123)', currentTitle: 'Project [P] brief' },
        { markdown: 'See [[Project brief[P]]](note:123)', currentTitle: 'Project brief[P]' },
    ];

    for (const { markdown, currentTitle } of cases) {
        const contentJson = await markdownToBlocksJson(markdown, {
            ensureTag: async () => {
                throw new Error('should not ensure tags');
            },
            findNotesByTitle: async () => {
                throw new Error('should not look up title-based references');
            },
            findNoteById: async (id) =>
                id === '123'
                    ? {
                          id: '123',
                          title: currentTitle,
                      }
                    : null,
        });

        const blocks = JSON.parse(contentJson);

        assert.deepEqual(blocks[0].content, [
            {
                type: 'text',
                text: 'See ',
                styles: {},
            },
            {
                type: 'reference',
                props: {
                    id: '123',
                    title: currentTitle,
                },
            },
        ]);
    }
});

test('markdownToBlocksJson leaves missing note-id references as text', async () => {
    const contentJson = await markdownToBlocksJson('See [[Missing Title]](note:404)', {
        ensureTag: async () => {
            throw new Error('should not ensure tags');
        },
        findNotesByTitle: async () => {
            throw new Error('should not look up title-based references');
        },
        findNoteById: async () => null,
    });

    const blocks = JSON.parse(contentJson);

    assert.deepEqual(blocks[0].content, [
        {
            type: 'text',
            text: 'See [[Missing Title]](note:404)',
            styles: {},
        },
    ]);
});

test('markdownToBlocksJson preserves note-id reference syntax inside inline code', async () => {
    const contentJson = await markdownToBlocksJson('Use `[[Old Title]](note:44)` as an example.', {
        ensureTag: async () => {
            throw new Error('should not ensure tags');
        },
        findNotesByTitle: async () => {
            throw new Error('should not look up title-based references');
        },
        findNoteById: async () => {
            throw new Error('should not look up references inside code');
        },
    });

    const roundTripMarkdown = await blocksToMarkdown(contentJson);

    assert.match(roundTripMarkdown, /`\[\[Old Title\]\]\(note:44\)`/);
});

test('markdownToBlocksJson preserves note-id reference syntax inside fenced code', async () => {
    const markdown = '```md\n[[Old Title]](note:44)\n```';
    const contentJson = await markdownToBlocksJson(markdown, {
        ensureTag: async () => {
            throw new Error('should not ensure tags');
        },
        findNotesByTitle: async () => {
            throw new Error('should not look up title-based references');
        },
        findNoteById: async () => {
            throw new Error('should not look up references inside code');
        },
    });

    const roundTripMarkdown = await blocksToMarkdown(contentJson);

    assert.match(roundTripMarkdown, /\[\[Old Title\]\]\(note:44\)/);
});

test('markdownToBlocksJson keeps portable tags, note-id references, hard breaks, and code text together', async () => {
    const markdown = [
        'See [[Old Title]](note:44) with [@project]\\',
        'Next line keeps the hard break.',
        '',
        '```md',
        'Keep [#literal] and [[Code Title]](note:55) as code.',
        '```',
    ].join('\n');

    const contentJson = await markdownToBlocksJson(markdown, {
        ensureTag: async (name) => ({ id: name === 'project' ? '12' : '13', name: `@${name}` }),
        findNotesByTitle: async () => [],
        findNoteById: async (id) =>
            id === '44'
                ? {
                      id: '44',
                      title: 'Current Title',
                  }
                : null,
    });
    const roundTripMarkdown = await blocksToMarkdown(contentJson);

    assert.match(roundTripMarkdown, /\[\[Current Title\]\]\(note:44\)/);
    assert.match(roundTripMarkdown, /\[@project\]/);
    assert.match(roundTripMarkdown, /with \[@project\]\\\nNext line keeps the hard break/);
    assert.match(roundTripMarkdown, /Keep \[#literal\] and \[\[Code Title\]\]\(note:55\) as code/);
});

test('markdownToBlocksJson leaves malformed note-id references as text', async () => {
    const contentJson = await markdownToBlocksJson('See [[Decimal]](note:1.5) and [[Huge]](note:9007199254740993)', {
        ensureTag: async () => {
            throw new Error('should not ensure tags');
        },
        findNotesByTitle: async () => {
            throw new Error('should not look up title-based references');
        },
        findNoteById: async () => null,
    });

    const blocks = JSON.parse(contentJson);

    assert.deepEqual(blocks[0].content, [
        {
            type: 'text',
            text: 'See [[Decimal]](note:1.5) and [[Huge]](note:9007199254740993)',
            styles: {},
        },
    ]);
});

test('blocksToMarkdown falls back to title-only references when reference ids are invalid', async () => {
    const content = JSON.stringify([
        {
            id: 'paragraph-1',
            type: 'paragraph',
            props: {},
            content: [
                {
                    type: 'reference',
                    props: {
                        title: 'Broken Reference',
                    },
                },
            ],
            children: [],
        },
    ]);

    const markdown = await blocksToMarkdown(content);

    assert.match(markdown, /\[\[Broken Reference\]\]/);
    assert.doesNotMatch(markdown, /note:/);
});

test('markdownToBlocksJson restores custom tag and reference inline content from explicit @ tags', async () => {
    const contentJson = await markdownToBlocksJson('[@project] [[Reference Note]]', {
        ensureTag: async () => ({
            id: '12',
            name: '@project',
        }),
        findNotesByTitle: async (title) => {
            if (title === 'Reference Note') {
                return [
                    {
                        id: '44',
                        title,
                    },
                ];
            }

            return [];
        },
    });

    const blocks = JSON.parse(contentJson);

    assert.deepEqual(blocks[0].content, [
        {
            type: 'tag',
            props: {
                id: '12',
                tag: '@project',
            },
        },
        {
            type: 'text',
            text: ' ',
            styles: {},
        },
        {
            type: 'reference',
            props: {
                id: '44',
                title: 'Reference Note',
            },
        },
    ]);
});

test('markdownToBlocksJson restores custom tag and reference inline content from explicit # tags', async () => {
    const contentJson = await markdownToBlocksJson('[#project] [[Reference Note]]', {
        ensureTag: async () => ({
            id: '12',
            name: '@project',
        }),
        findNotesByTitle: async (title) => {
            if (title === 'Reference Note') {
                return [
                    {
                        id: '44',
                        title,
                    },
                ];
            }

            return [];
        },
    });

    const blocks = JSON.parse(contentJson);

    assert.deepEqual(blocks[0].content, [
        {
            type: 'tag',
            props: {
                id: '12',
                tag: '@project',
            },
        },
        {
            type: 'text',
            text: ' ',
            styles: {},
        },
        {
            type: 'reference',
            props: {
                id: '44',
                title: 'Reference Note',
            },
        },
    ]);
});

test('markdownToBlocksJson leaves plain @ and # tokens as text to avoid accidental tag creation', async () => {
    const contentJson = await markdownToBlocksJson('Use @layer and #111 as-is.', {
        ensureTag: async () => {
            throw new Error('should not ensure tags');
        },
        findNotesByTitle: async () => [],
    });

    const blocks = JSON.parse(contentJson);

    assert.deepEqual(blocks[0].content, [
        {
            type: 'text',
            text: 'Use @layer and #111 as-is.',
            styles: {},
        },
    ]);
});

test('markdownToBlocksJson preserves angle-bracket text markers', async () => {
    const markdown = [
        '**<MARKER> Primary note, <MARKER-A> Follow-up note, <BR> Final note**',
        '',
        '* <MARKER> First list item',
        '* <MARKER-A> Second list item',
        '* <BR> Third list item',
    ].join('\n');

    const contentJson = await markdownToBlocksJson(markdown, {
        ensureTag: async () => {
            throw new Error('should not ensure tags');
        },
        findNotesByTitle: async () => [],
    });
    const roundTripMarkdown = await blocksToMarkdown(contentJson);

    assert.match(roundTripMarkdown, /<MARKER> Primary note/);
    assert.match(roundTripMarkdown, /<MARKER-A> Follow-up note/);
    assert.match(roundTripMarkdown, /<BR> Final note/);
    assert.match(roundTripMarkdown, /<MARKER> First list item/);
    assert.match(roundTripMarkdown, /<MARKER-A> Second list item/);
    assert.match(roundTripMarkdown, /<BR> Third list item/);
});

test('markdownToBlocksJson leaves angle-bracket text markers unchanged inside code', async () => {
    const markdown = ['Inline `<MARKER>` sample.', '', '```', '<MARKER-A>', '```'].join('\n');

    const contentJson = await markdownToBlocksJson(markdown, {
        ensureTag: async () => {
            throw new Error('should not ensure tags');
        },
        findNotesByTitle: async () => [],
    });
    const roundTripMarkdown = await blocksToMarkdown(contentJson);

    assert.match(roundTripMarkdown, /`<MARKER>`/);
    assert.match(roundTripMarkdown, /```text\n<MARKER-A>\n```/);
    assert.doesNotMatch(roundTripMarkdown, /&lt;MARKER(?:-A)?&gt;/);
});

test('markdownToBlocksJson preserves Markdown autolinks while protecting spaced angle text', async () => {
    const markdown = 'Visit <https://example.com>, email <user@example.com>, keep < https://example.com > literal.';

    const contentJson = await markdownToBlocksJson(markdown, {
        ensureTag: async () => {
            throw new Error('should not ensure tags');
        },
        findNotesByTitle: async () => [],
    });
    const roundTripMarkdown = await blocksToMarkdown(contentJson);

    assert.match(roundTripMarkdown, /<https:\/\/example\.com>/);
    assert.match(roundTripMarkdown, /<user@example\.com>/);
    assert.match(roundTripMarkdown, /< https:\/\/example\.com >/);
    assert.doesNotMatch(roundTripMarkdown, /&lt;/);
});

test('markdownToBlocksJson preserves numeric ranges inside angle-bracket text', async () => {
    const markdown = '<1~3> before <4~5>';

    const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
    const blocks = JSON.parse(contentJson);
    const roundTripMarkdown = await blocksToMarkdown(contentJson);

    assert.equal(blocks[0].content[0].text, markdown);
    assert.equal(blocks[0].content[0].styles.strike, undefined);
    assert.equal(roundTripMarkdown.trim(), markdown);
});

for (const { markdown, name } of tildeContractCases.literalNumericRanges) {
    test(`markdownToBlocksJson ${name} as plain text`, async () => {
        const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
        const blocks = JSON.parse(contentJson);
        const roundTripMarkdown = await blocksToMarkdown(contentJson);

        assert.deepEqual(blocks[0].content, [
            {
                type: 'text',
                text: markdown,
                styles: {},
            },
        ]);
        assert.equal(roundTripMarkdown.trim(), markdown);
    });
}

test('markdownToBlocksJson preserves text matching its internal tilde placeholder', async () => {
    const markdown = 'literal \uE000OBTILDE0\uE001 and 1~3 and 4~5';

    const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
    const blocks = JSON.parse(contentJson);

    assert.deepEqual(blocks[0].content, [
        {
            type: 'text',
            text: markdown,
            styles: {},
        },
    ]);
});

test('markdownToBlocksJson preserves encoded text matching its internal tilde placeholder', async () => {
    const encodedPlaceholder = '%ee%80%80OBTILDE0%ee%80%81';
    const markdown = `1~3 [literal](https://example.com/${encodedPlaceholder})`;

    const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
    const blocks = JSON.parse(contentJson);

    assert.equal(blocks[0].content[1].href, `https://example.com/${encodedPlaceholder}`);
    assert.equal(blocks[0].content[0].text, '1~3 ');
});

test('markdownToBlocksJson restores numeric ranges in bare URL destinations', async () => {
    const markdown = 'https://example.com/?range=1~3&other=4~5';

    const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
    const blocks = JSON.parse(contentJson);
    const roundTripMarkdown = await blocksToMarkdown(contentJson);

    assert.equal(blocks[0].content[0].href, markdown);
    assert.doesNotMatch(JSON.stringify(blocks), /OBTILDE/);
    assert.doesNotMatch(roundTripMarkdown, /OBTILDE/);
});

test('markdownToBlocksJson protects balanced link destinations containing numeric ranges', async () => {
    const destination = 'https://example.com/a(b)c/1~3/4~5';
    const markdown = `[Range](${destination})`;

    const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
    const blocks = JSON.parse(contentJson);
    const roundTripMarkdown = await blocksToMarkdown(contentJson);

    assert.equal(blocks[0].content[0].href, destination);
    assert.doesNotMatch(JSON.stringify(blocks), /OBTILDE/);
    assert.doesNotMatch(roundTripMarkdown, /OBTILDE/);
});

test('markdownToBlocksJson keeps angle placeholder-shaped image names literal', async () => {
    const placeholder = '\uE000OBANGLE0\uE001';
    const markdown = `![literal ${placeholder}](https://example.com/x.png)\n\nKeep <MARKER> text.`;

    const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
    const blocks = JSON.parse(contentJson);

    assert.equal(blocks[0].props.name, `literal ${placeholder}`);
    assert.equal(blocks[1].content[0].text, 'Keep <MARKER> text.');
});

test('markdownToBlocksJson keeps hard-break placeholder-shaped image names literal', async () => {
    const placeholder = '\uE000OBHARDBREAK0\uE001';
    const markdown = `![literal ${placeholder}](https://example.com/x.png)\n\nline one\\\nline two`;

    const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
    const blocks = JSON.parse(contentJson);

    assert.equal(blocks[0].props.name, `literal ${placeholder}`);
    assert.equal(blocks[1].content[0].text, 'line one\nline two');
});

test('markdownToBlocksJson preserves numeric tilde ranges across hard break lines', async () => {
    const markdown = 'Range is 1~3 and 4~5\\\nNext range is 6~7.';

    const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
    const blocks = JSON.parse(contentJson);
    const renderedMarkdown = await blocksToMarkdown(contentJson);

    assert.equal(blocks.length, 1);
    assert.deepEqual(blocks[0].content, [
        {
            type: 'text',
            text: 'Range is 1~3 and 4~5\nNext range is 6~7.',
            styles: {},
        },
    ]);
    assert.equal(renderedMarkdown, `${markdown}\n`);
    assert.doesNotMatch(renderedMarkdown, /~~/);
});

test('markdownToBlocksJson preserves line-end hard break markers without doubling them', async () => {
    const markdown = 'Updated: 2026-06-01\\\n상태: 실제 프로젝트 구조 기반 초안';

    const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
    const blocks = JSON.parse(contentJson);

    assert.equal(blocks.length, 1);
    assert.deepEqual(blocks[0].content, [
        {
            type: 'text',
            text: 'Updated: 2026-06-01\n상태: 실제 프로젝트 구조 기반 초안',
            styles: {},
        },
    ]);
    assert.equal(await blocksToMarkdown(contentJson), `${markdown}\n`);
});

test('markdownToBlocksJson preserves consecutive line-end hard break markers without paragraph splitting', async () => {
    const markdown = 'Updated: 2026-06-01\\\n\\\n상태: 실제 프로젝트 구조 기반 초안';

    const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
    const blocks = JSON.parse(contentJson);

    assert.equal(blocks.length, 1);
    assert.deepEqual(blocks[0].content, [
        {
            type: 'text',
            text: 'Updated: 2026-06-01\n\n상태: 실제 프로젝트 구조 기반 초안',
            styles: {},
        },
    ]);
    assert.equal(await blocksToMarkdown(contentJson), `${markdown}\n`);
});

test('markdownToBlocksJson preserves trailing backslashes at paragraph boundaries', async () => {
    const markdown = 'Path: C:\\\n\nNext paragraph';

    const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
    const blocks = JSON.parse(contentJson);

    assert.equal(blocks.length, 2);
    assert.deepEqual(blocks[0].content, [
        {
            type: 'text',
            text: 'Path: C:\\',
            styles: {},
        },
    ]);
    assert.equal(await blocksToMarkdown(contentJson), `${markdown}\n`);
});

test('markdownToBlocksJson preserves trailing backslashes before block boundaries', async () => {
    const cases = ['foo\\\n# heading', 'foo\\\n- item', 'foo\\\n> quote'];

    for (const markdown of cases) {
        const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
        const blocks = JSON.parse(contentJson);

        assert.deepEqual(blocks[0].content, [
            {
                type: 'text',
                text: 'foo\\',
                styles: {},
            },
        ]);
    }
});

test('markdownToBlocksJson preserves code block trailing backslashes', async () => {
    const markdown = ['```', 'Updated: 2026-06-01\\', '```'].join('\n');

    const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
    const blocks = JSON.parse(contentJson);
    const renderedMarkdown = await blocksToMarkdown(contentJson);

    assert.equal(blocks[0].type, 'codeBlock');
    assert.equal(blocks[0].content[0].text, 'Updated: 2026-06-01\\');
    assert.match(renderedMarkdown, /Updated: 2026-06-01\\\n```/);
});

test('markdownToBlocksJson preserves trailing backslashes inside multiline inline code', async () => {
    const markdown = '`foo\\\nbar`';

    const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
    const blocks = JSON.parse(contentJson);
    const renderedMarkdown = await blocksToMarkdown(contentJson);

    assert.equal(blocks[0].content[0].text, 'foo\\ bar');
    assert.equal(blocks[0].content[0].styles.code, true);
    assert.match(renderedMarkdown, /foo\\ bar/);
});

for (const { markdown, name, struckText } of tildeContractCases.strikethrough) {
    test(`markdownToBlocksJson ${name}`, async () => {
        const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
        const blocks = JSON.parse(contentJson);
        const roundTripMarkdown = await blocksToMarkdown(contentJson);
        const struckContent = blocks[0].content.find(
            (inline: { styles?: { strike?: boolean }; text?: string }) => inline.styles?.strike,
        );

        assert.equal(struckContent?.text, struckText);
        assert.ok(roundTripMarkdown.includes(`~~${struckText}~~`));
    });
}

test('markdownToBlocksJson leaves numeric tilde ranges unchanged inside code', async () => {
    const markdown = ['Code is `1~3 and 4~5`.', '', '~~~', '1~3 and 4~5', '~~~'].join('\n');

    const contentJson = await markdownToBlocksJson(markdown, {
        ensureTag: async () => {
            throw new Error('should not ensure tags');
        },
        findNotesByTitle: async () => [],
    });
    const roundTripMarkdown = await blocksToMarkdown(contentJson);

    assert.match(roundTripMarkdown, /`1~3 and 4~5`/);
    assert.match(roundTripMarkdown, /1~3 and 4~5/);
    assert.doesNotMatch(roundTripMarkdown, /1~~3 and 4~~5/);
});

test('markdownToBlocksJson restores numeric tilde ranges in link destinations', async () => {
    const markdown = '[1~3](https://example.com/range/1~3)';

    const contentJson = await markdownToBlocksJson(markdown, {
        ensureTag: async () => {
            throw new Error('should not ensure tags');
        },
        findNotesByTitle: async () => [],
    });
    const blocks = JSON.parse(contentJson);
    const roundTripMarkdown = await blocksToMarkdown(contentJson);

    assert.equal(blocks[0].content[0].href, 'https://example.com/range/1~3');
    assert.equal(roundTripMarkdown.trim(), markdown);
});

test('markdownToBlocksJson restores numeric tilde ranges in image names', async () => {
    const markdown = '![1~3 and 4~5](https://example.com/ranges.png)';

    const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
    const blocks = JSON.parse(contentJson);
    const roundTripMarkdown = await blocksToMarkdown(contentJson);

    assert.equal(blocks[0].props.name, '1~3 and 4~5');
    assert.doesNotMatch(blocks[0].props.name, /OBTILDE/);
    assert.doesNotMatch(roundTripMarkdown, /OBTILDE/);
    assert.equal(hasNumericTildeRangeMarkerLoss(markdown, roundTripMarkdown), false);
});

test('numeric tilde range loss detection accepts portable backslash escapes', () => {
    assert.equal(hasNumericTildeRangeMarkerLoss('1~3 and 4~5', '1\\~3 and 4\\~5'), false);
    assert.equal(hasNumericTildeRangeMarkerLoss('1~~3 and 4~~5', '1\\~\\~3 and 4\\~\\~5'), false);
});

test('numeric tilde range loss detection rejects changed delimiter lengths', () => {
    assert.equal(hasNumericTildeRangeMarkerLoss('1~3 and 4~5', '1~~3 and 4~~5'), true);
    assert.equal(hasNumericTildeRangeMarkerLoss('1~~3 and 4~~5', '1~3 and 4~5'), true);
    assert.equal(hasNumericTildeRangeMarkerLoss('1~3 and 4~~5', '1~~3 and 4~5'), true);
});

test('numeric tilde range loss detection rejects changed endpoints', () => {
    assert.equal(hasNumericTildeRangeMarkerLoss('1~3 and 4~5', '1~4 and 4~5'), true);
    assert.equal(hasNumericTildeRangeMarkerLoss('10 kg~20 kg', '10 kg~30 kg'), true);
});

test('numeric tilde range loss detection accepts duplicated link representations', () => {
    const sourceMarkdown = 'https://example.com/?range=1~3';

    assert.equal(hasNumericTildeRangeMarkers(sourceMarkdown), true);
    assert.equal(
        hasNumericTildeRangeMarkerLoss(
            sourceMarkdown,
            '[https://example.com/?range=1~3](https://example.com/?range=1~3)',
        ),
        false,
    );
});

test('markdownToBlocksJson leaves nonnumeric tildes in image names unchanged', async () => {
    const markdown = '![a~b](https://example.com/ranges.png)';

    const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
    const blocks = JSON.parse(contentJson);

    assert.equal(blocks[0].props.name, 'a~b');
    assert.doesNotMatch(JSON.stringify(blocks), /OBTILDE/);
});

test('markdownToBlocksJson preserves email autolinks containing tildes', async () => {
    const markdown = '<a1~b2@example.com>';

    const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
    const blocks = JSON.parse(contentJson);
    const roundTripMarkdown = await blocksToMarkdown(contentJson);

    assert.equal(blocks[0].content[0].type, 'link');
    assert.equal(blocks[0].content[0].href, 'mailto:a1~b2@example.com');
    assert.equal(roundTripMarkdown.trim(), markdown);
});

test('markdownToBlocksJson matches inline-code delimiters by exact backtick-run length', async () => {
    const markdown = '`a```b 1~3 and 4~5` outside 6~7 and 8~9';

    const contentJson = await markdownToBlocksJson(markdown, noopMarkdownImportDeps);
    const blocks = JSON.parse(contentJson);

    assert.equal(blocks[0].content[0].text, 'a```b 1~3 and 4~5');
    assert.equal(blocks[0].content[0].styles.code, true);
    assert.equal(blocks[0].content.at(-1).text, ' outside 6~7 and 8~9');
    assert.equal(blocks[0].content.at(-1).styles.strike, undefined);
});

test('extractLiteralAngleBracketTextTokens ignores Markdown autolinks', () => {
    assert.deepEqual(
        extractLiteralAngleBracketTextTokens(
            'Visit <https://example.com>, email <user@example.com>, then keep <MARKER_A> as text.',
        ),
        ['<MARKER_A>'],
    );
});

test('markdownToBlocksJson leaves ambiguous references as plain text', async () => {
    const contentJson = await markdownToBlocksJson('See [[Shared Title]] later', {
        ensureTag: async () => {
            throw new Error('should not ensure tags');
        },
        findNotesByTitle: async () => [
            { id: '8', title: 'Shared Title' },
            { id: '9', title: 'Shared Title' },
        ],
    });

    const blocks = JSON.parse(contentJson);

    assert.deepEqual(blocks[0].content, [
        {
            type: 'text',
            text: 'See [[Shared Title]] later',
            styles: {},
        },
    ]);
});

test('markdownToBlocksJson restores custom inline content inside table cells', async () => {
    const contentJson = await markdownToBlocksJson(
        '| Name | Value |\n| --- | --- |\n| Project | [@project] [[Reference Note]] |',
        {
            ensureTag: async () => ({
                id: '12',
                name: '@project',
            }),
            findNotesByTitle: async (title) => {
                if (title === 'Reference Note') {
                    return [
                        {
                            id: '44',
                            title,
                        },
                    ];
                }

                return [];
            },
        },
    );

    const blocks = JSON.parse(contentJson);
    const tableBlock = blocks.find((block: { type: string }) => block.type === 'table');

    assert.ok(tableBlock);
    assert.deepEqual(tableBlock.content.rows[1].cells[1].content, [
        {
            type: 'tag',
            props: {
                id: '12',
                tag: '@project',
            },
        },
        {
            type: 'text',
            text: ' ',
            styles: {},
        },
        {
            type: 'reference',
            props: {
                id: '44',
                title: 'Reference Note',
            },
        },
    ]);
});

test('extractTagIdsFromContentJson collects tags from table cells', () => {
    const tagIds = extractTagIdsFromContentJson(
        JSON.stringify([
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
                                                tag: '@project',
                                            },
                                        },
                                    ],
                                },
                                {
                                    type: 'tableCell',
                                    content: [
                                        {
                                            type: 'tag',
                                            props: {
                                                id: '12',
                                                tag: '@project',
                                            },
                                        },
                                        {
                                            type: 'tag',
                                            props: {
                                                id: '34',
                                                tag: '@todo',
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
                children: [],
            },
        ]),
    );

    assert.deepEqual(tagIds.sort(), ['12', '34']);
});

test('countReferenceInlinesFromContentJson counts structured note references', () => {
    const content = JSON.stringify([
        {
            id: 'paragraph-1',
            type: 'paragraph',
            content: [
                { type: 'text', text: 'See ', styles: {} },
                { type: 'reference', props: { id: '7', title: 'Reference note' } },
            ],
            children: [],
        },
    ]);

    assert.equal(countReferenceInlinesFromContentJson(content), 1);
});
