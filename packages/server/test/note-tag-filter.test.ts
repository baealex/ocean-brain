import assert from 'node:assert/strict';
import test from 'node:test';

import { buildNoteTagNamesWhere, normalizeNoteTagNames } from '../src/modules/note-tag-filter.js';

test('normalizeNoteTagNames trims blanks and deduplicates in order', () => {
    assert.deepEqual(normalizeNoteTagNames([' @OceanBrain ', '@todo', '', '@OceanBrain', '   ', '@todo']), [
        '@OceanBrain',
        '@todo',
    ]);
});

test('buildNoteTagNamesWhere returns an AND filter for all requested tag names', () => {
    assert.deepEqual(buildNoteTagNamesWhere(['@OceanBrain', '@todo', '@OceanBrain'], 'and'), {
        AND: [{ tags: { some: { name: '@OceanBrain' } } }, { tags: { some: { name: '@todo' } } }],
    });
});

test('buildNoteTagNamesWhere returns an OR filter for any requested tag name', () => {
    assert.deepEqual(buildNoteTagNamesWhere(['@OceanBrain', '@todo'], 'or'), {
        tags: {
            some: {
                name: {
                    in: ['@OceanBrain', '@todo'],
                },
            },
        },
    });
});

test('buildNoteTagNamesWhere returns an impossible filter when no usable tag name remains', () => {
    assert.deepEqual(buildNoteTagNamesWhere(['   ', ''], 'and'), { id: -1 });
});
