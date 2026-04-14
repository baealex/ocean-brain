import assert from 'node:assert/strict';
import test from 'node:test';
import {
    OCEAN_BRAIN_CUSTOM_BLOCK_TYPES,
    OCEAN_BRAIN_CUSTOM_INLINE_CONTENT_TYPES,
} from '../../../../../client/src/components/schema/custom-types.js';
import {
    buildNoteSearchProjection,
    buildNoteSearchText,
    extractVisibleSearchTextFromContent,
    getUnknownNoteSearchNodeTypeCounts,
    matchesNoteSearchQuery,
    NOTE_SEARCH_EXTRACTOR_NODE_TYPES,
    NOTE_SEARCH_IGNORED_NODE_TYPES,
    NOTE_SEARCH_PASS_THROUGH_NODE_TYPES,
    NOTE_SEARCH_TEXT_SCHEMA_VERSION,
    parseNoteSearchQuery,
    resetUnknownNoteSearchNodeTypeCountsForTest,
} from './search.js';

test('note search text schema version is explicit for future projection rebuilds', () => {
    assert.equal(NOTE_SEARCH_TEXT_SCHEMA_VERSION, 1);
});

test('buildNoteSearchProjection stores normalized lowercase title and visible content', () => {
    const projection = buildNoteSearchProjection({
        title: 'Roadmap 123',
        content: JSON.stringify([
            {
                id: 'paragraph-1',
                type: 'paragraph',
                props: {},
                content: [
                    {
                        type: 'text',
                        text: 'Visible Content',
                        styles: {},
                    },
                ],
                children: [],
            },
        ]),
    });

    assert.deepEqual(projection, {
        searchableText: 'roadmap 123 visible content',
        searchableTextVersion: NOTE_SEARCH_TEXT_SCHEMA_VERSION,
    });
});

test('note search explicitly classifies every Ocean Brain custom BlockNote type', () => {
    const knownTypes = new Set([
        ...NOTE_SEARCH_EXTRACTOR_NODE_TYPES,
        ...NOTE_SEARCH_PASS_THROUGH_NODE_TYPES,
        ...NOTE_SEARCH_IGNORED_NODE_TYPES,
    ]);

    for (const type of [...OCEAN_BRAIN_CUSTOM_INLINE_CONTENT_TYPES, ...OCEAN_BRAIN_CUSTOM_BLOCK_TYPES]) {
        assert.equal(knownTypes.has(type), true, `expected search handling for custom type "${type}"`);
    }
});

test('extractVisibleSearchTextFromContent keeps visible inline and prop text while excluding internal ids and metadata', () => {
    const content = JSON.stringify([
        {
            id: 'paragraph-123',
            type: 'paragraph',
            props: {
                textAlignment: 'left',
                backgroundColor: 'default',
            },
            content: [
                {
                    type: 'text',
                    text: 'Visible roadmap',
                    styles: {},
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
                        title: 'Reference 123',
                    },
                },
                {
                    type: 'text',
                    text: ' ',
                    styles: {},
                },
                {
                    type: 'tag',
                    props: {
                        id: '7',
                        tag: '@project',
                    },
                },
            ],
            children: [],
        },
        {
            id: 'image-9',
            type: 'image',
            props: {
                name: 'Architecture Diagram',
                caption: 'Search preview',
                url: 'https://example.com/image.png',
            },
            children: [],
        },
    ]);

    const extracted = extractVisibleSearchTextFromContent(content);

    assert.match(extracted, /Visible roadmap/);
    assert.match(extracted, /Reference 123/);
    assert.match(extracted, /@project/);
    assert.match(extracted, /Architecture Diagram/);
    assert.match(extracted, /Search preview/);
    assert.doesNotMatch(extracted, /paragraph-123/);
    assert.doesNotMatch(extracted, /\bleft\b/);
    assert.doesNotMatch(extracted, /example\.com/);
});

test('extractVisibleSearchTextFromContent keeps nested text for unknown nodes without indexing arbitrary props', () => {
    resetUnknownNoteSearchNodeTypeCountsForTest();

    const content = JSON.stringify([
        {
            id: 'custom-1',
            type: 'futureWidget',
            props: {
                internalId: 'widget-123',
                rawPayload: 'do-not-index',
            },
            content: [
                {
                    type: 'text',
                    text: 'Visible widget text',
                    styles: {},
                },
            ],
            children: [
                {
                    id: 'child-1',
                    type: 'paragraph',
                    props: {},
                    content: [
                        {
                            type: 'text',
                            text: 'Nested paragraph text',
                            styles: {},
                        },
                    ],
                    children: [],
                },
            ],
        },
    ]);

    const extracted = extractVisibleSearchTextFromContent(content);

    assert.match(extracted, /Visible widget text/);
    assert.match(extracted, /Nested paragraph text/);
    assert.doesNotMatch(extracted, /widget-123/);
    assert.doesNotMatch(extracted, /do-not-index/);
    assert.deepEqual([...getUnknownNoteSearchNodeTypeCounts().entries()], [['futureWidget', 1]]);
});

test('extractVisibleSearchTextFromContent keeps visible link text without indexing href metadata', () => {
    const content = JSON.stringify([
        {
            id: 'paragraph-1',
            type: 'paragraph',
            props: {},
            content: [
                {
                    type: 'link',
                    href: 'https://oceanbrain.example/docs',
                    content: [
                        {
                            type: 'text',
                            text: 'Ocean Brain Docs',
                            styles: {},
                        },
                    ],
                },
            ],
            children: [],
        },
    ]);

    const extracted = extractVisibleSearchTextFromContent(content);

    assert.match(extracted, /Ocean Brain Docs/);
    assert.doesNotMatch(extracted, /oceanbrain\.example/);
});

test('extractVisibleSearchTextFromContent counts repeated unknown node types without duplicating rules', () => {
    resetUnknownNoteSearchNodeTypeCountsForTest();

    const content = JSON.stringify([
        {
            id: 'custom-1',
            type: 'futureWidget',
            props: {},
            content: [
                {
                    type: 'text',
                    text: 'Alpha',
                    styles: {},
                },
            ],
        },
        {
            id: 'custom-2',
            type: 'futureWidget',
            props: {},
            content: [
                {
                    type: 'text',
                    text: 'Beta',
                    styles: {},
                },
            ],
        },
    ]);

    const extracted = extractVisibleSearchTextFromContent(content);

    assert.match(extracted, /Alpha/);
    assert.match(extracted, /Beta/);
    assert.deepEqual([...getUnknownNoteSearchNodeTypeCounts().entries()], [['futureWidget', 2]]);
});

test('matchesNoteSearchQuery ignores internal id noise for numeric searches', () => {
    const note = {
        title: 'Roadmap',
        content: JSON.stringify([
            {
                id: 'paragraph-123',
                type: 'paragraph',
                props: {},
                content: [
                    {
                        type: 'text',
                        text: 'Visible content only',
                        styles: {},
                    },
                ],
                children: [],
            },
        ]),
    };

    assert.equal(matchesNoteSearchQuery(note, '123'), false);
});

test('matchesNoteSearchQuery keeps visible numeric matches from table cells, tags, and references', () => {
    const note = {
        title: 'Sprint board',
        content: JSON.stringify([
            {
                id: 'table-1',
                type: 'table',
                props: {},
                content: {
                    type: 'tableContent',
                    columnWidths: [120],
                    headerRows: 1,
                    rows: [
                        {
                            cells: [
                                {
                                    type: 'tableCell',
                                    props: {
                                        colspan: 1,
                                        rowspan: 1,
                                    },
                                    content: [
                                        {
                                            type: 'text',
                                            text: 'Task 123',
                                            styles: {},
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
                children: [],
            },
            {
                id: 'paragraph-1',
                type: 'paragraph',
                props: {},
                content: [
                    {
                        type: 'tag',
                        props: {
                            id: '8',
                            tag: '@release-123',
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
                            title: 'Reference 123',
                        },
                    },
                ],
                children: [],
            },
        ]),
    };

    assert.equal(matchesNoteSearchQuery(note, '123'), true);
});

test('matchesNoteSearchQuery can use a precomputed searchable text field', () => {
    const note = {
        title: 'Ignored original title',
        content: JSON.stringify([]),
        searchableText: buildNoteSearchText({
            title: 'Roadmap',
            content: JSON.stringify([
                {
                    id: 'paragraph-1',
                    type: 'paragraph',
                    props: {},
                    content: [
                        {
                            type: 'text',
                            text: 'Sprint 42',
                            styles: {},
                        },
                    ],
                    children: [],
                },
            ]),
        }),
        searchableTextVersion: NOTE_SEARCH_TEXT_SCHEMA_VERSION,
    };

    assert.equal(matchesNoteSearchQuery(note, 'roadmap 42'), true);
    assert.equal(matchesNoteSearchQuery(note, 'roadmap -42'), false);
});

test('matchesNoteSearchQuery applies excluded terms against visible text only', () => {
    const note = {
        title: 'Roadmap',
        content: JSON.stringify([
            {
                id: 'paragraph-123',
                type: 'paragraph',
                props: {},
                content: [
                    {
                        type: 'text',
                        text: 'Quarterly roadmap',
                        styles: {},
                    },
                ],
                children: [],
            },
        ]),
    };

    assert.equal(matchesNoteSearchQuery(note, 'roadmap -123'), true);
    assert.equal(matchesNoteSearchQuery(note, 'roadmap -quarterly'), false);
});

test('parseNoteSearchQuery splits included and excluded tokens', () => {
    assert.deepEqual(parseNoteSearchQuery(' alpha  beta  -gamma '), {
        included: ['alpha', 'beta'],
        excluded: ['gamma'],
        hasFilters: true,
    });
});
