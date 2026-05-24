import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildNoteGraph,
    contentReferencesNote,
    extractReferenceBlocksFromContent,
    syncReferenceTitlesInContent,
} from './content-blocks.js';

test('extractReferenceBlocksFromContent reads nested inline references', () => {
    const content = JSON.stringify([
        {
            id: 'paragraph-1',
            type: 'paragraph',
            props: {},
            content: [
                {
                    type: 'text',
                    text: 'See ',
                    styles: {},
                },
                {
                    type: 'reference',
                    props: {
                        title: 'Linked note',
                        id: '42',
                    },
                },
            ],
            children: [
                {
                    id: 'paragraph-2',
                    type: 'paragraph',
                    props: {},
                    content: [
                        {
                            type: 'reference',
                            props: {
                                id: '43',
                                title: 'Nested note',
                            },
                        },
                    ],
                    children: [],
                },
            ],
        },
    ]);

    const references = extractReferenceBlocksFromContent(content);

    assert.deepEqual(
        references.map((reference) => reference.props?.id),
        ['42', '43'],
    );
    assert.equal(contentReferencesNote(content, 43), true);
});

test('extractReferenceBlocksFromContent reads references inside table cells', () => {
    const content = JSON.stringify([
        {
            type: 'table',
            rows: [
                {
                    cells: [
                        [
                            {
                                type: 'reference',
                                props: {
                                    id: '44',
                                    title: 'Table note',
                                },
                            },
                        ],
                    ],
                },
            ],
        },
    ]);

    assert.equal(contentReferencesNote(content, 44), true);
});

test('syncReferenceTitlesInContent updates reference props structurally', () => {
    const content = JSON.stringify([
        {
            id: 'paragraph-1',
            type: 'paragraph',
            props: {},
            content: [
                {
                    type: 'reference',
                    props: {
                        title: 'Old title',
                        id: '7',
                    },
                },
            ],
            children: [],
        },
    ]);

    const syncedContent = syncReferenceTitlesInContent(content, new Map([['7', 'Current title']]));

    assert.ok(syncedContent);
    assert.equal(JSON.parse(syncedContent)[0].content[0].props.title, 'Current title');
});

test('reference helpers ignore invalid note JSON', () => {
    assert.equal(contentReferencesNote('{bad-json', 7), false);
    assert.deepEqual(extractReferenceBlocksFromContent('{bad-json'), []);
    assert.equal(syncReferenceTitlesInContent('{bad-json', new Map([['7', 'Current title']])), null);
});

test('buildNoteGraph ignores broken reference targets', () => {
    const graph = buildNoteGraph([
        {
            id: 1,
            title: 'Source',
            content: JSON.stringify([
                {
                    type: 'paragraph',
                    content: [
                        {
                            type: 'reference',
                            props: {
                                id: '2',
                                title: 'Target',
                            },
                        },
                        {
                            type: 'reference',
                            props: {
                                id: '99',
                                title: 'Missing',
                            },
                        },
                    ],
                },
            ]),
        },
        {
            id: 2,
            title: 'Target',
            content: JSON.stringify([]),
        },
    ]);

    assert.deepEqual(graph.links, [{ source: '1', target: '2' }]);
    assert.deepEqual(graph.nodes, [
        { id: '1', title: 'Source', connections: 1 },
        { id: '2', title: 'Target', connections: 1 },
    ]);
});
