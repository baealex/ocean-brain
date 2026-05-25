import assert from 'node:assert/strict';
import test from 'node:test';

import {
    assertExpectedNoteVersion,
    isNoteVersionConflictError,
    NOTE_UPDATE_CONFLICT_CODE,
    parseNoteVersion,
} from './write-conflict.js';

test('parseNoteVersion accepts epoch and ISO timestamps', () => {
    assert.equal(parseNoteVersion('1770000000000'), 1770000000000);
    assert.equal(parseNoteVersion('2026-02-01T00:00:00.000Z'), 1769904000000);
    assert.equal(parseNoteVersion(undefined), null);
});

test('assertExpectedNoteVersion rejects stale writes with a GraphQL conflict code', () => {
    assert.throws(
        () =>
            assertExpectedNoteVersion({
                expectedUpdatedAt: '1770000000000',
                currentUpdatedAt: new Date(1770000001000),
            }),
        (error) => {
            assert.equal(isNoteVersionConflictError(error), true);
            assert.equal(isNoteVersionConflictError(error) ? error.code : '', NOTE_UPDATE_CONFLICT_CODE);
            assert.equal(isNoteVersionConflictError(error) ? error.currentUpdatedAt : '', '1770000001000');
            return true;
        },
    );
});

test('assertExpectedNoteVersion allows matching versions and forced writes', () => {
    assert.doesNotThrow(() =>
        assertExpectedNoteVersion({
            expectedUpdatedAt: '1770000000000',
            currentUpdatedAt: new Date(1770000000000),
        }),
    );
    assert.doesNotThrow(() =>
        assertExpectedNoteVersion({
            currentUpdatedAt: new Date(1770000000000),
        }),
    );
});
