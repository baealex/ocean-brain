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

test('contentReferencesNote compares normalized reference ids', () => {
    const content = JSON.stringify([
        {
            id: 'paragraph-1',
            type: 'paragraph',
            props: {},
            content: [
                {
                    type: 'reference',
                    props: {
                        title: 'Linked note',
                        id: ' 42 ',
                    },
                },
            ],
            children: [],
        },
    ]);

    assert.equal(contentReferencesNote(content, 42), true);
    assert.equal(contentReferencesNote(content, '42'), true);
});

test('extractReferenceBlocksFromContent reads references inside deeply nested list items', () => {
    const content = JSON.stringify([
        {
            id: 'list-1',
            type: 'bulletListItem',
            props: {},
            content: [{ type: 'text', text: 'Level 1', styles: {} }],
            children: [
                {
                    id: 'list-2',
                    type: 'bulletListItem',
                    props: {},
                    content: [{ type: 'text', text: 'Level 2', styles: {} }],
                    children: [
                        {
                            id: 'list-3',
                            type: 'bulletListItem',
                            props: {},
                            content: [
                                {
                                    type: 'text',
                                    text: 'Level 3 ',
                                    styles: {},
                                },
                                {
                                    type: 'reference',
                                    props: {
                                        id: '99',
                                        title: 'Deep reference',
                                    },
                                },
                            ],
                            children: [],
                        },
                    ],
                },
            ],
        },
    ]);

    const references = extractReferenceBlocksFromContent(content);

    assert.deepEqual(
        references.map((reference) => reference.props?.id),
        ['99'],
    );
    assert.equal(contentReferencesNote(content, 99), true);
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

test('syncReferenceTitlesInContent matches normalized reference ids', () => {
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
                        id: ' 7 ',
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

const createGraphNote = (id: number, title: string) => ({
    id,
    title,
    updatedAt: new Date('2026-08-02T12:00:00.000Z'),
    tags: [] as Array<{ id: number; name: string }>,
});

test('buildNoteGraph ignores references whose source or target node is missing', () => {
    const updatedAt = new Date('2026-08-02T12:00:00.000Z');
    const graph = buildNoteGraph(
        [
            { id: 1, title: 'Source', updatedAt, tags: [{ id: 10, name: '@product' }] },
            { id: 2, title: 'Target', updatedAt, tags: [] },
        ],
        [
            { sourceNoteId: 1, targetNoteId: 2 },
            { sourceNoteId: 1, targetNoteId: 99 },
            { sourceNoteId: 99, targetNoteId: 2 },
        ],
    );

    assert.deepEqual(graph.links, [{ source: '1', target: '2' }]);
    assert.deepEqual(graph.nodes, [
        {
            id: '1',
            title: 'Source',
            connections: 1,
            updatedAt: String(updatedAt.getTime()),
            tags: [{ id: '10', name: '@product' }],
        },
        { id: '2', title: 'Target', connections: 1, updatedAt: String(updatedAt.getTime()), tags: [] },
    ]);
});

test('buildNoteGraph ignores self references', () => {
    const graph = buildNoteGraph([createGraphNote(1, 'Source')], [{ sourceNoteId: 1, targetNoteId: 1 }]);

    assert.deepEqual(graph.links, []);
    assert.deepEqual(graph.nodes, [
        {
            id: '1',
            title: 'Source',
            connections: 0,
            updatedAt: '1785672000000',
            tags: [],
        },
    ]);
});

test('buildNoteGraph collapses reverse references into one undirected link', () => {
    const graph = buildNoteGraph(
        [createGraphNote(1, 'Source'), createGraphNote(2, 'Target')],
        [
            { sourceNoteId: 1, targetNoteId: 2 },
            { sourceNoteId: 2, targetNoteId: 1 },
        ],
    );

    assert.deepEqual(graph.links, [{ source: '1', target: '2' }]);
    assert.deepEqual(graph.nodes, [
        { id: '1', title: 'Source', connections: 1, updatedAt: '1785672000000', tags: [] },
        { id: '2', title: 'Target', connections: 1, updatedAt: '1785672000000', tags: [] },
    ]);
});

test('buildNoteGraph preserves indexed links across more than 1,000 notes', () => {
    const noteCount = 1_001;
    const notes = Array.from({ length: noteCount }, (_, index) => ({
        ...createGraphNote(index + 1, `Note ${index + 1}`),
    }));
    const references = Array.from({ length: noteCount - 1 }, (_, index) => ({
        sourceNoteId: index + 1,
        targetNoteId: index + 2,
    }));

    const graph = buildNoteGraph(notes, references);

    assert.equal(graph.nodes.length, noteCount);
    assert.equal(graph.links.length, noteCount - 1);
    assert.deepEqual(graph.links.at(0), { source: '1', target: '2' });
    assert.deepEqual(graph.links.at(-1), { source: '1000', target: '1001' });
    assert.equal(graph.nodes.at(0)?.connections, 1);
    assert.equal(graph.nodes.at(500)?.connections, 2);
    assert.equal(graph.nodes.at(-1)?.connections, 1);
});
