import assert from 'node:assert/strict';
import test from 'node:test';

import {
    clampViewSectionLimit,
    normalizeViewSectionInput,
    normalizeViewTabTitle,
    normalizeViewTagNames,
    pickNextActiveViewTabId,
} from './workspace.js';

test('normalizeViewTagNames trims values and canonicalizes plain or hash-prefixed tags', () => {
    assert.deepEqual(normalizeViewTagNames([' project ', '#doing', '@todo', '', '@todo']), [
        '@project',
        '@doing',
        '@todo',
    ]);
});

test('normalizeViewSectionInput derives a default title and clamps invalid limits', () => {
    assert.deepEqual(
        normalizeViewSectionInput({
            title: '   ',
            tagNames: ['project', '#review'],
            mode: 'or',
            limit: 999,
        }),
        {
            title: '@project + @review',
            tagNames: ['@project', '@review'],
            mode: 'or',
            limit: 20,
        },
    );
});

test('normalizeViewSectionInput rejects sections without usable tags', () => {
    assert.throws(() =>
        normalizeViewSectionInput({
            title: 'Inbox',
            tagNames: ['   ', ''],
        }),
    );
});

test('normalizeViewTabTitle falls back to an untitled label', () => {
    assert.equal(normalizeViewTabTitle('   '), 'Untitled View');
    assert.equal(normalizeViewTabTitle(' Agent '), 'Agent');
});

test('clampViewSectionLimit keeps values inside the allowed range', () => {
    assert.equal(clampViewSectionLimit(undefined), 5);
    assert.equal(clampViewSectionLimit(0), 1);
    assert.equal(clampViewSectionLimit(8), 8);
    assert.equal(clampViewSectionLimit(99), 20);
});

test('pickNextActiveViewTabId falls back to the first remaining tab after deletion', () => {
    assert.equal(pickNextActiveViewTabId([3, 7, 9], 7, 7), 3);
    assert.equal(pickNextActiveViewTabId([3, 7, 9], 7, 3), 3);
    assert.equal(pickNextActiveViewTabId([7], 7, 7), null);
});
