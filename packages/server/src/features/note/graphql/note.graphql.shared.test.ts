import assert from 'node:assert/strict';
import test from 'node:test';

import {
    contentReferencesNote,
    extractReferenceBlocksFromContent,
    syncReferenceTitlesInContent,
} from './note.graphql.shared.js';

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
