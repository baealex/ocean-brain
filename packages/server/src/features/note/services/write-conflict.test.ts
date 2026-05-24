import assert from 'node:assert/strict';
import test from 'node:test';

import { GraphQLError } from 'graphql';
import { assertExpectedNoteVersion, NOTE_UPDATE_CONFLICT_CODE, parseNoteVersion } from './write-conflict.js';

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
            assert.equal(error instanceof GraphQLError, true);
            assert.equal((error as GraphQLError).extensions.code, NOTE_UPDATE_CONFLICT_CODE);
            assert.equal((error as GraphQLError).extensions.currentUpdatedAt, '1770000001000');
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
